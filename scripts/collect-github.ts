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
import { spawnSync } from 'node:child_process'
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
// ---------------------------------------------------------------------------
function gh<T>(query: string, vars: Record<string, string>): T {
  const args = ['api', 'graphql']
  for (const [k, v] of Object.entries(vars)) args.push('-f', `${k}=${v}`)
  args.push('-f', `query=${query}`)
  const r = spawnSync('gh', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) throw new Error(`gh falhou: ${r.stderr?.trim() || r.error?.message}`)
  const json = JSON.parse(r.stdout)
  if (json.errors?.length) throw new Error(`graphql: ${json.errors[0].message}`)
  return json.data as T
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
const userMap = new Map<string, string>()
for (const [login, name] of Object.entries(config.githubUsers ?? {})) {
  userMap.set(login.toLowerCase(), name)
}
const botLogins = new Set((config.githubBots ?? []).map(b => b.toLowerCase()))
function isBotLogin(login: string): boolean {
  return botLogins.has(login.toLowerCase()) || /(\[bot\]|-bot$|^dependabot)/i.test(login)
}

const cutoff = new Date()
cutoff.setDate(cutoff.getDate() - MERGED_CUTOFF_DAYS)

const repos = discoverRepos(config.reposRoot)
const allPrs: unknown[] = []
const seenLogins = new Set<string>()
let skipped = 0

for (const repo of repos) {
  const remote = remoteOf(repo.path)
  const ghRepo = remote ? parseGitHub(remote) : null
  if (!ghRepo) {
    console.log(`— ${repo.name}: sem remote do GitHub, pulado`)
    skipped++
    continue
  }

  process.stdout.write(`→ ${repo.name} (${ghRepo.owner}/${ghRepo.repo})… `)
  const [open, merged] = [
    await fetchPrs(ghRepo, 'OPEN', null),
    await fetchPrs(ghRepo, 'MERGED', cutoff),
  ]

  for (const pr of [...open, ...merged]) {
    const author = pr.author?.login ?? 'ghost'
    seenLogins.add(author)
    allPrs.push({
      repo: repo.name,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      state: pr.state,
      draft: pr.isDraft,
      author,
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
    for (const r of pr.reviews.nodes) if (r.author?.login) seenLogins.add(r.author.login)
  }
  console.log(`${open.length} abertos, ${merged.length} mergeados (desde ${cutoff.toISOString().slice(0, 10)})`)
}

// logins sem mapeamento para nome do time (avisar pra completar o config)
const unmapped = [...seenLogins]
  .filter(l => !userMap.has(l.toLowerCase()) && !isBotLogin(l))
  .sort()

const users: Record<string, { name: string; bot: boolean }> = {}
for (const login of seenLogins) {
  users[login] = { name: userMap.get(login.toLowerCase()) ?? login, bot: isBotLogin(login) }
}

const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'github.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  users,
  prs: allPrs,
}))

console.log(`\n✓ github.json: ${allPrs.length} PRs de ${repos.length - skipped} repos`)
if (unmapped.length) {
  console.log(`⚠ logins sem mapeamento em config.githubUsers: ${unmapped.join(', ')}`)
}
