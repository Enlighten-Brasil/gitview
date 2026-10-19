/**
 * Coletor de branches (issue #123) — inventário de refs/heads por repo.
 *
 * Por repo (pool de 4): `git for-each-ref refs/heads` (tip + committerdate);
 * refs de produção/integração pelo seam scripts/lib/refs.ts. Por branch:
 * ahead/behind vs produção e vs a PRIMEIRA ref de integração resolvida
 * (ordem da config), autores à frente e linhas +/− — tudo SEM merges
 * (decisão #7: a produção do merge já está contada no PR; medido nos repos
 * reais: 1370 de ahead somado COM merges vs 763 dedup sem).
 *
 * DESVIO CONSCIENTE do padrão stats.json: `authorsAhead` leva E-MAIL CRU
 * (%ae), não o nome canônico — branches.json é fato puramente git: edição de
 * alias/time reflete no frontend sem recoletar (o mapeamento e-mail→dev usa
 * team.json#devs[].emails). `additions`/`deletions` somam o numstat cru do
 * walk (sem filtro de excludePaths), pela mesma razão.
 *
 * Performance: spawn SEMPRE assíncrono dentro do mapPool — chamadas sync
 * (execFileSync/spawnSync) bloqueiam o event loop e ANULAM o pool (probe da
 * issue: wall == soma serial com sync; padrão fetchRepo de lib/repos.ts).
 * A exceção é o seam lib/refs.ts (spawnSync interno): a resolução de
 * produção/integração roda num pré-passo sequencial ANTES do pool.
 *
 * Spawns por branch: ahead/autores/linhas saem do MESMO `git log --no-merges
 * --numstat` do par branch×produção (economiza um spawn por branch); behind
 * via `rev-list --count`; integração via `rev-list --left-right --count`
 * (1 spawn pros dois lados).
 *
 * Sem fetch próprio: o frescor vem do fetch do collect.ts no início da cadeia
 * (`pnpm collect`) — por isso a recoleta light (/__collect?light=1) NÃO roda
 * este coletor: sem fetch, re-enumerar produziria resultado idêntico ao do
 * último full, só com custo. O `--full` da cadeia é aceito e ignorado (a
 * enumeração é sempre completa).
 *
 * Saída: public/data/branches.json — { generatedAt, repos: [{ repo,
 * productionRef, integrationRefs, branches }] } (tipos em src/types.ts).
 */
import type { BranchRow, BranchStatus, RepoBranches } from '../src/types'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_BRANCH_STALE_DAYS, loadConfig, resolveReposRoot } from './lib/config'
import { resolveIntegRefs, resolveProdRef } from './lib/refs'
import { discoverRepos, mapPool } from './lib/repos'
import { BOT_BRANCH_RE, botBranchSet } from './lib/team'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/** separador de cabeçalho de commit no walk — o git emite o byte 0x1f (%x1f); numstat nunca começa com ele */
const SEP = '\x1F'

const config = loadConfig()
const staleDays = config.branchStaleDays ?? DEFAULT_BRANCH_STALE_DAYS
const botBranches = botBranchSet(config)

/**
 * git com stdout em streaming (padrão do runGit de lib/scope.ts) — log com
 * numstat de branch muito à frente emite centenas de KB e spawnSync além de
 * estourar maxBuffer BLOQUEARIA o event loop dentro do pool.
 */
function runGit(repoPath: string, args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', ['-C', repoPath, ...args])
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => chunks.push(c))
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git ${args[0]} falhou em ${repoPath}: ${Buffer.concat(errChunks).toString().trim()}`))
        return
      }
      resolvePromise(Buffer.concat(chunks).toString('utf-8'))
    })
  })
}

/** saída de `rev-list --count` / lado de `--left-right --count` → inteiro >= 0 */
function countOf(raw: string): number {
  const n = Number.parseInt(raw.trim(), 10)
  if (!Number.isFinite(n) || n < 0)
    throw new Error(`contagem inesperada do git: "${raw.trim().slice(0, 40)}"`)
  return n
}

/** resultado do walk à frente de produção: contagem, e-mails crus distintos e linhas (sem merges) */
interface AheadWalk { ahead: number, emails: string[], additions: number, deletions: number }

/**
 * Parse do `git log --no-merges --no-renames --numstat --format=%x1f%ae`:
 * linhas de cabeçalho (byte SEP) = 1 commit à frente + %ae cru; linhas com
 * tab = numstat ('-' de binário conta 0). E-mails distintos por lowercase,
 * preservando a primeira grafia vista (ordem estável).
 */
function parseAheadWalk(out: string): AheadWalk {
  let ahead = 0
  let additions = 0
  let deletions = 0
  const seen = new Map<string, string>()
  for (const line of out.split('\n')) {
    if (line.startsWith(SEP)) {
      ahead++
      const email = line.slice(1).trim()
      if (email) {
        const key = email.toLowerCase()
        if (!seen.has(key))
          seen.set(key, email)
      }
      continue
    }
    if (!line.includes('\t'))
      continue
    const [adds, dels] = line.split('\t')
    additions += adds === '-' ? 0 : (Number(adds) || 0)
    deletions += dels === '-' ? 0 : (Number(dels) || 0)
  }
  return {
    ahead,
    emails: [...seen.values()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    additions,
    deletions,
  }
}

interface RefRow { full: string, name: string, tip: string, committerDate: string }

/** refs/heads do repo (bare ou checkout) — nome curto pro JSON, full pros comandos (sem ambiguidade com tags) */
async function listHeads(repoPath: string): Promise<RefRow[]> {
  const out = await runGit(repoPath, [
    'for-each-ref',
    'refs/heads',
    '--format=%(refname)%09%(refname:lstrip=2)%09%(objectname)%09%(committerdate:iso8601-strict)',
  ])
  const rows: RefRow[] = []
  for (const line of out.split('\n')) {
    const parts = line.split('\t')
    if (parts.length < 4 || !parts[0])
      continue
    rows.push({ full: parts[0], name: parts[1], tip: parts[2], committerDate: parts[3].trim() })
  }
  return rows
}

/** union fechada de status (src/types.ts) — ordem: produção/integração (estrutura), bot (nome), pousada (idade), feature */
function statusOf(name: string, prodRef: string, integRefs: string[], aheadProd: number, lastActivityMs: number, nowMs: number): BranchStatus {
  if (name === prodRef)
    return 'production'
  if (integRefs.includes(name))
    return 'integration'
  if (BOT_BRANCH_RE.test(name) || botBranches.has(name.toLowerCase()))
    return 'bot'
  if (aheadProd === 0 && nowMs - lastActivityMs >= staleDays * 86_400_000)
    return 'pousada'
  return 'feature'
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const repos = discoverRepos(resolveReposRoot(config), config.exclude ?? [])
console.log(`Inventariando branches de ${repos.length} repos (pool de 4; pousada = aheadProd 0 e ≥ ${staleDays}d sem atividade)...`)

// Pré-passo sequencial: o seam lib/refs.ts usa spawnSync — resolvido ANTES do
// pool para o miolo por branch (log/rev-list) rodar 100% assíncrono. Repo sem
// ref de produção resolvível (ex.: clone vazio) é ERRO nomeado do seam: fica
// de fora do branches.json, os demais seguem (padrão de tolerância da casa).
const refsT0 = Date.now()
const resolved = new Map<string, { prodRef: string, integRefs: string[] }>()
let refsFailed = 0
for (const repo of repos) {
  try {
    resolved.set(repo.name, {
      prodRef: resolveProdRef(repo.path, config.productionRef),
      integRefs: resolveIntegRefs(repo.path, config.integrationRefs),
    })
  }
  catch (err) {
    refsFailed++
    console.error(`✗ ${repo.name}: ${(err as Error).message}`)
  }
}
const refsMs = Date.now() - refsT0
if (refsFailed)
  console.warn(`! ${refsFailed} repo(s) sem refs resolvíveis — fora do branches.json`)

const nowMs = Date.now()
// ordem de saída estável mesmo com o processamento paralelo (padrão collect-releases)
const byRepo = new Map<string, RepoBranches>()
const perRepoMs = new Map<string, number>()
let totalBranches = 0
let failed = 0

const poolT0 = Date.now()
await mapPool(repos, 4, async (repo) => {
  const refs = resolved.get(repo.name)
  if (!refs)
    return
  const { prodRef, integRefs } = refs
  // aheadInt/behindInt vs a PRIMEIRA ref de integração da ordem da config que
  // existe no repo; sem nenhuma, os dois campos viajam null (shape da issue)
  const integRef = integRefs[0] ?? null
  const t0 = Date.now()
  try {
    const heads = await listHeads(repo.path)
    const branches: BranchRow[] = []
    for (const head of heads) {
      const aheadWalk = parseAheadWalk(await runGit(repo.path, [
        'log',
        head.full,
        '--not',
        prodRef,
        '--no-merges',
        '--no-renames',
        '--numstat',
        '--format=%x1f%ae',
      ]))
      const behindProd = countOf(await runGit(repo.path, [
        'rev-list',
        '--count',
        prodRef,
        '--not',
        head.full,
        '--no-merges',
      ]))
      let aheadInt: number | null = null
      let behindInt: number | null = null
      if (integRef) {
        const sides = (await runGit(repo.path, [
          'rev-list',
          '--left-right',
          '--count',
          `${head.full}...${integRef}`,
          '--no-merges',
        ])).trim().split(/\s+/)
        if (sides.length !== 2)
          throw new Error(`--left-right --count inesperado: "${sides.join(' ')}"`)
        aheadInt = countOf(sides[0])
        behindInt = countOf(sides[1])
      }
      const lastActivityMs = Date.parse(head.committerDate)
      if (Number.isNaN(lastActivityMs))
        throw new Error(`branch "${head.name}": committerdate inválida ("${head.committerDate}")`)
      branches.push({
        name: head.name,
        tip: head.tip,
        lastActivity: new Date(lastActivityMs).toISOString(),
        aheadProd: aheadWalk.ahead,
        behindProd,
        aheadInt,
        behindInt,
        authorsAhead: aheadWalk.emails,
        additions: aheadWalk.additions,
        deletions: aheadWalk.deletions,
        status: statusOf(head.name, prodRef, integRefs, aheadWalk.ahead, lastActivityMs, nowMs),
      })
    }
    const counts: Record<BranchStatus, number> = { production: 0, integration: 0, feature: 0, bot: 0, pousada: 0 }
    for (const b of branches)
      counts[b.status]++
    byRepo.set(repo.name, { repo: repo.name, productionRef: prodRef, integrationRefs: integRefs, branches })
    totalBranches += branches.length
    const ms = Date.now() - t0
    perRepoMs.set(repo.name, ms)
    console.log(`✓ ${repo.name}: ${branches.length} branches — ${counts.production} production, ${counts.integration} integration, ${counts.feature} feature, ${counts.bot} bot, ${counts.pousada} pousada (${(ms / 1000).toFixed(1)}s)`)
  }
  catch (err) {
    failed++
    console.error(`✗ ${repo.name}: ${(err as Error).message}`)
  }
})
const poolMs = Date.now() - poolT0

const out: RepoBranches[] = []
for (const repo of repos) {
  const row = byRepo.get(repo.name)
  if (row)
    out.push(row)
}

const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, 'branches.json')
writeFileSync(outFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  repos: out,
}))

const serialSum = [...perRepoMs.values()].reduce((a, b) => a + b, 0)
const kb = (statSync(outFile).size / 1024).toFixed(1)
console.log(`\n✓ branches.json: ${totalBranches} branches em ${out.length} repos — ${kb} KB${failed ? ` · ${failed} repo(s) com falha` : ''}`)
// evidência de async do pool: wall < soma serial por repo (sync anularia o pool: wall == soma)
console.log(`⏱ pool ${(poolMs / 1000).toFixed(1)}s wall vs ${(serialSum / 1000).toFixed(1)}s soma serial por repo (pool de 4, spawn async) · refs ${(refsMs / 1000).toFixed(1)}s no pré-passo`)
