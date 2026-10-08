/**
 * Coletor de Pull Requests do GitHub (complemento do collect.ts).
 *
 * 1. Descobre repos em `reposRoot` e resolve owner/repo pelo remote origin
 * 2. Busca PRs abertos (todos) e mergeados (últimos 400 dias) via `gh api graphql`,
 *    já com reviews inline (1 request por página de 100 PRs)
 * 3. Grava tudo em public/data/github.json — o frontend continua 100% estático
 *
 * Requer `gh` autenticado (gh auth login) com acesso aos repos.
 * Logins do GitHub são mapeados para os nomes canônicos via config.githubUsers.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/** mergeados mais antigos que isso ficam de fora (cobre a visão de 12M com folga) */
const MERGED_CUTOFF_DAYS = 400

interface Config {
  reposRoot: string
  exclude?: string[]
  /** login do GitHub (case-insensitive) -> nome canônico do time */
  githubUsers?: Record<string, string>
  /** logins que são bots (dependabot etc.) */
  githubBots?: string[]
}

const config = JSON.parse(readFileSync(join(root, 'config.json'), 'utf-8')) as Config

// ---------------------------------------------------------------------------
// descoberta: repo local -> owner/repo no GitHub (via remote origin)
// ---------------------------------------------------------------------------
function discoverRepos(reposRoot: string): { name: string; path: string }[] {
  const excluded = new Set(config.exclude ?? [])
  const found: { name: string; path: string }[] = []
  if (existsSync(join(reposRoot, '.git'))) {
    found.push({ name: reposRoot.split(/[\\/]/).pop()!, path: reposRoot })
  }
  for (const entry of readdirSync(reposRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || excluded.has(entry.name)) continue
    const p = join(reposRoot, entry.name)
    if (existsSync(join(p, '.git'))) found.push({ name: entry.name, path: p })
  }
  return found.sort((a, b) => a.name.localeCompare(b.name))
}

function remoteOf(path: string): string | null {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: path, encoding: 'utf-8' })
  if (r.status !== 0) return null
  return r.stdout.trim() || null
}

/** git@github.com:Owner/repo.git | https://github.com/Owner/repo(.git) -> Owner/repo */
function parseGitHub(remote: string): { owner: string; repo: string } | null {
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i)
  return m ? { owner: m[1], repo: m[2] } : null
}

// ---------------------------------------------------------------------------
// gh api graphql (args em array — sem problemas de quoting do PowerShell)
// async pra rodar repos em paralelo
// ---------------------------------------------------------------------------
function gh<T>(query: string, vars: Record<string, string>): Promise<T> {
  return new Promise((resolvePromise, reject) => {
    const args = ['api', 'graphql']
    for (const [k, v] of Object.entries(vars)) args.push('-f', `${k}=${v}`)
    args.push('-f', `query=${query}`)
    const child = spawn('gh', args)
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => chunks.push(c))
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`gh falhou: ${Buffer.concat(errChunks).toString().trim()}`))
        return
      }
      try {
        const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'))
        if (json.errors?.length) {
          reject(new Error(`graphql: ${json.errors[0].message}`))
          return
        }
        resolvePromise(json.data as T)
      }
      catch (e) {
        reject(e)
      }
    })
  })
}

/** map assíncrono com concorrência limitada (repos em paralelo) */
async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  }))
}

const PR_QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 100, after: $cursor, states: [$states], orderBy: { field: $order, direction: DESC }) {
      nodes {
        number title url state isDraft createdAt updatedAt mergedAt
        additions deletions changedFiles
        author { login }
        reviews(first: 20) { nodes { author { login } state submittedAt } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
  rateLimit { remaining }
}`

interface GhPr {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'MERGED'
  isDraft: boolean
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  additions: number
  deletions: number
  changedFiles: number
  author: { login: string } | null
  reviews: { nodes: { author: { login: string } | null; state: string; submittedAt: string }[] }
}

interface QueryResult {
  repository: {
    pullRequests: {
      nodes: GhPr[]
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
    }
  } | null
  rateLimit: { remaining: number }
}

async function fetchPrs(
  ghRepo: { owner: string; repo: string },
  states: 'OPEN' | 'MERGED',
  cutoff: Date | null,
): Promise<GhPr[]> {
  const order = states === 'OPEN' ? 'CREATED_AT' : 'UPDATED_AT'
  const query = PR_QUERY.replace('$states', states).replace('$order', order)
  const out: GhPr[] = []
  let cursor: string | null = null

  for (let page = 0; page < 30; page++) {
    const vars: Record<string, string> = { owner: ghRepo.owner, name: ghRepo.repo }
    if (cursor) vars.cursor = cursor
    const data = await gh<QueryResult>(query, vars)
    const prs = data.repository?.pullRequests
    if (!prs) break
    out.push(...prs.nodes)
    if (!prs.pageInfo.hasNextPage) break
    // mergeados vêm por UPDATED_AT desc: para quando a página já passou do cutoff
    const oldest = prs.nodes[prs.nodes.length - 1]
    if (cutoff && oldest && new Date(oldest.updatedAt) < cutoff) break
    cursor = prs.pageInfo.endCursor
  }
  return out
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const FULL = process.argv.includes('--full')

const userMap = new Map<string, string>()
for (const [login, name] of Object.entries(config.githubUsers ?? {})) {
  userMap.set(login.toLowerCase(), name)
}
const botLogins = new Set((config.githubBots ?? []).map(b => b.toLowerCase()))
function isBotLogin(login: string): boolean {
  return botLogins.has(login.toLowerCase()) || /(\[bot\]|-bot$|^dependabot)/i.test(login)
}

/** PR normalizado no formato do github.json (shape solto pra aceitar o arquivo anterior) */
interface PrRow {
  repo: string
  number: number
  state: string
  author: string
  reviews: { author: string }[]
  [k: string]: unknown
}

const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, 'github.json')

// incremental: PRs mergeados mudam pouco — refetch só dos atualizados desde a última
// coleta (margem de 1 dia) e merge com o arquivo anterior. `--full` ignora o cache.
const prev = (!FULL && existsSync(outFile))
  ? JSON.parse(readFileSync(outFile, 'utf-8')) as { generatedAt: string; prs: PrRow[] }
  : null

const cutoff = new Date()
if (prev) {
  cutoff.setTime(new Date(prev.generatedAt).getTime() - 24 * 3600 * 1000)
  console.log(`Modo: incremental (mergeados atualizados desde ${cutoff.toISOString().slice(0, 10)})`)
}
else {
  cutoff.setDate(cutoff.getDate() - MERGED_CUTOFF_DAYS)
  console.log(`Modo: completo (mergeados dos últimos ${MERGED_CUTOFF_DAYS} dias)`)
}

const repos = discoverRepos(config.reposRoot)
const fresh = new Map<string, PrRow>() // repo#number -> PR
let fetchedCount = 0
let skipped = 0

await mapPool(repos, 4, async (repo) => {
  const remote = remoteOf(repo.path)
  const ghRepo = remote ? parseGitHub(remote) : null
  if (!ghRepo) {
    console.log(`— ${repo.name}: sem remote do GitHub, pulado`)
    skipped++
    return
  }

  const t0 = Date.now()
  try {
    const [open, merged] = await Promise.all([
      fetchPrs(ghRepo, 'OPEN', null),
      fetchPrs(ghRepo, 'MERGED', cutoff),
    ])

    for (const pr of [...open, ...merged]) {
      fresh.set(`${repo.name}#${pr.number}`, {
        repo: repo.name,
        number: pr.number,
        title: pr.title,
        url: pr.url,
        state: pr.state,
        draft: pr.isDraft,
        author: pr.author?.login ?? 'ghost',
        createdAt: pr.createdAt,
        mergedAt: pr.mergedAt,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        reviews: pr.reviews.nodes.map(r => ({
          author: r.author?.login ?? 'ghost',
          state: r.state,
          submittedAt: r.submittedAt,
        })),
      })
    }
    fetchedCount += open.length + merged.length
    console.log(`✓ ${repo.name}: ${open.length} abertos, ${merged.length} mergeados atualizados (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  }
  catch (err) {
    console.error(`✗ ${repo.name}: ${(err as Error).message}`)
  }
})

// merge: preserva mergeados anteriores que o fetch incremental não revalidou;
// abertos NÃO são preservados — a lista fresca de OPEN é a verdade
// (PR fechado sem merge some do painel, como no modo completo)
let kept = 0
if (prev) {
  // mergeados fora da janela de MERGED_CUTOFF_DAYS expiram (o incremental não os revalida mais)
  const pruneCutoff = new Date()
  pruneCutoff.setDate(pruneCutoff.getDate() - MERGED_CUTOFF_DAYS)
  for (const p of prev.prs) {
    const key = `${p.repo}#${p.number}`
    if (p.state !== 'MERGED' || fresh.has(key)) continue
    const mergedAt = p.mergedAt as string | null
    if (mergedAt && new Date(mergedAt) < pruneCutoff) continue
    fresh.set(key, p)
    kept++
  }
}

const allPrs = [...fresh.values()]

// logins -> usuários, calculado sobre o conjunto final (frescos + preservados)
const seenLogins = new Set<string>()
for (const p of allPrs) {
  seenLogins.add(p.author)
  for (const r of p.reviews) if (r.author) seenLogins.add(r.author)
}

// logins sem mapeamento para nome do time (avisar pra completar o config)
const unmapped = [...seenLogins]
  .filter(l => !userMap.has(l.toLowerCase()) && !isBotLogin(l))
  .sort()

const users: Record<string, { name: string; bot: boolean }> = {}
for (const login of seenLogins) {
  users[login] = { name: userMap.get(login.toLowerCase()) ?? login, bot: isBotLogin(login) }
}

writeFileSync(outFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  users,
  prs: allPrs,
}))

console.log(`\n✓ github.json: ${allPrs.length} PRs (${fetchedCount} buscados, ${kept} mergeados preservados) de ${repos.length - skipped} repos`)
if (unmapped.length) {
  console.log(`⚠ logins sem mapeamento em config.githubUsers: ${unmapped.join(', ')}`)
}
