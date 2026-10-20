/**
 * Coletor de topologia (issue #126) — UM `graph-<repo>.json` por repo em
 * public/data/, para o renderer do grafo de commits (issue #127). O frontend
 * estático carrega só o arquivo do repo visitado — por isso um arquivo por
 * repo, e não um JSON único.
 *
 * Por que um coletor separado (e não o banco): a tabela `commits` não tem
 * coluna `parents` e merges NEM ENTRAM nas métricas (`--no-merges` do
 * collect.ts, decisão #7). A topologia vem do git DIRETO — este coletor não
 * toca gitview.db nem stats.json, e a decisão #7 segue intacta: merges só
 * aparecem no grafo, nunca nas contagens.
 * ⚠ NÃO "corrija" este coletor acrescentando --no-merges: os merges são os
 * CONECTORES do desenho — sem eles o grafo perde as junções de branches.
 *
 * Por repo (pool de 4 com spawn ASSÍNCRONO — lição da #123: chamada sync
 * dentro do mapPool bloqueia o event loop e anula o pool):
 *
 *   git log --all --date-order -n<janela> \
 *     --pretty=format:%x1e%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%D
 *
 * - %H/%P em 40-hex COMPLETO: o renderer monta índice hash→linha e clipa
 *   parents fora da janela (sem resolução de hash abreviado).
 * - autor CANÔNICO via resolveAliases (devProfiles do team.local.json).
 * - `date` = AUTHOR date (%aI) normalizada para UTC ISO com ms — mesmo campo
 *   e padrão do collect.ts (toUtcIso). O --date-order do git ordena pelo
 *   timestamp de COMMIT, então a data de autor pode vir invertida (medido nos
 *   14 clones reais: 44 inversões em ~3,9 mil commits); o sort estável
 *   descendente abaixo GARANTE o invariante do contrato (check-data) — na
 *   prática não quase move nada, empates preservam a ordem do date-order e o
 *   renderer indexa por hash.
 * - %D = decoration de refs/tags SEM parênteses. Clones gerenciados são BARE
 *   com refs locais (refs/heads/*, sem prefixo origin/): branches saem com
 *   nome CURTO ("develop", "HEAD -> main") e tags como "tag: <nome>". `refs`
 *   viaja como ARRAY com um item de decoration por entrada ([] sem refs) —
 *   split por ", " é inequívoco: nome de ref nunca contém espaço.
 *
 * Janela = GITVIEW_GRAPH_WINDOW (default DEFAULT_GRAPH_WINDOW = 1000) commits
 * por repo — CONTAGEM, não dias: o período coberto varia com a velocidade do
 * repo (medido 2026-10-19: 1000 commits ≈ 87d no repo mais ativo). Valor
 * inválido/0/negativo → aviso + default (parse em lib/config.ts).
 *
 * Sem fetch próprio: o frescor vem do fetch do collect.ts no início da cadeia
 * (`pnpm collect`). Por isso a recoleta light (/__collect?light=1) NÃO roda
 * este coletor (a light não escaneia git) — os graph-*.json existentes
 * SOBREVIVEM à light: nada os reescreve nem apaga (lib/clean.ts só remove no
 * clean explícito, pelo wildcard public/data/*.json). O `--full` da cadeia é
 * aceito e ignorado (a janela é sempre a configurada; o walk é completo).
 *
 * Saída por arquivo: { generatedAt, repo, window, commits: [{ hash, parents,
 * author, date, subject, refs }] } em ordem descendente de data. Interfaces
 * do lado WRITER — src/types.ts é território da #127 (o renderer tipa o mesmo
 * shape de lá; o contrato é o exemplo real no PR da #126).
 */
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEFAULT_GRAPH_WINDOW, loadConfig, resolveReposRoot } from './lib/config'
import { discoverRepos, mapPool } from './lib/repos'
import { resolveAliases } from './lib/team'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/** separadores de registro/campo no formato do git log (bytes 0x1e/0x1f — padrão collect.ts; %s e %D nunca os contêm) */
const REC = '\x1E'
const SEP = '\x1F'

const HASH40_RE = /^[0-9a-f]{40}$/

interface GraphCommit {
  /** SHA completo (40-hex) */
  hash: string
  /** SHAs completos dos pais (40-hex); [] na raiz, 2+ em merge */
  parents: string[]
  /** autor canônico (resolveAliases — devProfiles do team.local.json) */
  author: string
  /** author date em UTC ISO com ms ('2026-10-08T18:05:13.000Z' — padrão collect.ts) */
  date: string
  /** assunto do commit (%s, linha única) */
  subject: string
  /** itens de decoration (%D): 'HEAD -> main', 'tag: v1.0.0', 'develop'…; [] sem refs */
  refs: string[]
}

interface GraphFile {
  generatedAt: string
  repo: string
  window: number
  commits: GraphCommit[]
}

const config = loadConfig()
const graphWindow = config.graphWindow ?? DEFAULT_GRAPH_WINDOW
const { emailToCanonical } = resolveAliases(config)

/** author date → UTC ISO com ms (mesmo padrão do collect.ts; cópia local — o collect.ts está fora do território da #126) */
function toUtcIso(date: string): string {
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? date : d.toISOString()
}

/**
 * git com stdout em streaming (padrão do runGit de collect-branches.ts):
 * log de 1000 commits emite centenas de KB e spawnSync BLOQUEARIA o event
 * loop dentro do pool.
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

/** parse da saída do git log: 1 registro por commit (REC), 7 campos por registro (SEP) — valida 40-hex e data */
function parseGraphLog(raw: string, repoName: string): GraphCommit[] {
  const commits: GraphCommit[] = []
  for (const block of raw.split(REC)) {
    if (!block.trim())
      continue
    const header = block.split('\n')[0].split(SEP)
    if (header.length < 7) {
      throw new Error(`${repoName}: registro inesperado do git log (${header.length} campos): "${block.split('\n')[0].slice(0, 80)}"`)
    }
    const [hash, parents, name, email, date, subject, refs] = header
    if (!HASH40_RE.test(hash))
      throw new Error(`${repoName}: hash fora do formato 40-hex ("${hash.slice(0, 50)}")`)
    const parentList = parents.trim() ? parents.trim().split(/\s+/) : []
    for (const p of parentList) {
      if (!HASH40_RE.test(p))
        throw new Error(`${repoName}: parent fora do formato 40-hex ("${p.slice(0, 50)}") em ${hash}`)
    }
    const iso = toUtcIso(date.trim())
    if (Number.isNaN(Date.parse(iso)))
      throw new Error(`${repoName}: data inválida ("${date.slice(0, 40)}") em ${hash}`)
    commits.push({
      hash,
      parents: parentList,
      author: emailToCanonical.get(email.trim().toLowerCase()) ?? name.trim(),
      date: iso,
      subject: subject ?? '',
      // %D vem sem parênteses, itens separados por ", " — nome de ref nunca
      // contém espaço, então o split é inequívoco ('HEAD -> main' e
      // 'tag: v1.0' chegam como o git os escreveu)
      refs: (refs ?? '').split(', ').map(s => s.trim()).filter(Boolean),
    })
  }
  return commits
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const repos = discoverRepos(resolveReposRoot(config), config.exclude ?? [])
console.log(`Coletando topologia de ${repos.length} repos (pool de 4; janela ${graphWindow} commits/repo, COM merges — a decisão #7 vale só para as métricas)...`)

const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })

let written = 0
let totalCommits = 0
let totalMerges = 0
let failed = 0
const perRepoMs = new Map<string, number>()

const poolT0 = Date.now()
await mapPool(repos, 4, async (repo) => {
  const t0 = Date.now()
  try {
    const out = await runGit(repo.path, [
      'log',
      '--all',
      '--date-order',
      `-n${graphWindow}`,
      '--pretty=format:%x1e%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s%x1f%D',
    ])
    const commits = parseGraphLog(out, repo.name)
    // contrato: ordem descendente por timestamp. Sort ESTÁVEL — empates
    // preservam a ordem topológica do --date-order (inversões de author date
    // são raras: 44 em ~3,9 mil commits medidos nos clones reais)
    commits.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
    const file: GraphFile = {
      generatedAt: new Date().toISOString(),
      repo: repo.name,
      window: graphWindow,
      commits,
    }
    const outFile = join(outDir, `graph-${repo.name}.json`)
    writeFileSync(outFile, JSON.stringify(file))
    const ms = Date.now() - t0
    perRepoMs.set(repo.name, ms)
    written++
    totalCommits += commits.length
    const merges = commits.filter(c => c.parents.length >= 2).length
    totalMerges += merges
    const kb = (statSync(outFile).size / 1024).toFixed(1)
    const span = commits.length >= 2
      ? ((Date.parse(commits[0].date) - Date.parse(commits[commits.length - 1].date)) / 86_400_000).toFixed(1)
      : '0.0'
    console.log(`✓ ${repo.name}: ${commits.length} commits (${merges} merges) — ${kb} KB, span ${span}d (${(ms / 1000).toFixed(1)}s)`)
  }
  catch (err) {
    failed++
    console.error(`✗ ${repo.name}: ${(err as Error).message}`)
  }
})
const poolMs = Date.now() - poolT0

const serialSum = [...perRepoMs.values()].reduce((a, b) => a + b, 0)
console.log(`\n✓ graph-*.json: ${written} arquivos, ${totalCommits} commits (${totalMerges} merges) — janela ${graphWindow}${failed ? ` · ${failed} repo(s) com falha` : ''}`)
// evidência de async do pool: wall < soma serial por repo (sync anularia o pool: wall == soma)
console.log(`⏱ pool ${(poolMs / 1000).toFixed(1)}s wall vs ${(serialSum / 1000).toFixed(1)}s soma serial por repo (pool de 4, spawn async)`)
