/**
 * Coletor de releases (complemento do collect.ts / collect-github.ts).
 *
 * 1. Tags git locais (`git tag` com data) — cobertura universal, sem API
 * 2. Releases do GitHub via `gh api` REST — enriquece a tag com nome, notas e URL
 * 3. Conta commits por release (desde a tag anterior) e commits não liberados
 *    (desde a última tag) usando o data/gitview.db
 *
 * Saída: public/data/releases.json — o frontend continua 100% estático.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/** notas de release truncadas nesse tamanho (o link pro GitHub tem o resto) */
const NOTES_MAX = 3000

interface Config {
  reposRoot: string
  exclude?: string[]
}

const config = JSON.parse(readFileSync(join(root, 'config.json'), 'utf-8')) as Config

// ---------------------------------------------------------------------------
// descoberta (mesmo padrão dos outros coletores)
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
  return r.status === 0 ? r.stdout.trim() || null : null
}

/** git@github.com:Owner/repo.git | https://github.com/Owner/repo(.git) -> Owner/repo */
function parseGitHub(remote: string): { owner: string; repo: string } | null {
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i)
  return m ? { owner: m[1], repo: m[2] } : null
}

// ---------------------------------------------------------------------------
// tags locais: nome + data (iso8601 estrito é parseável por new Date)
// ---------------------------------------------------------------------------
interface Tag { tag: string; date: string }

function gitTags(repoPath: string): Tag[] {
  const r = spawnSync('git', [
    '-C', repoPath,
    'tag', '--sort=creatordate',
    '--format=%(refname:short)%09%(creatordate:iso8601-strict)',
  ], { encoding: 'utf-8' })
  if (r.status !== 0) return []
  return r.stdout.split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [tag, date] = line.split('\t')
      return { tag, date: new Date(date).toISOString() }
    })
    .filter(t => t.tag && !Number.isNaN(new Date(t.date).getTime()))
}

// ---------------------------------------------------------------------------
// releases do GitHub (notas/nome/url) — 1 request por repo, últimas 100
// ---------------------------------------------------------------------------
interface GhRelease {
  tag_name: string
  name: string | null
  published_at: string | null
  prerelease: boolean
  draft: boolean
  html_url: string
  body: string | null
}

function ghReleases(ghRepo: { owner: string; repo: string }): Map<string, GhRelease> {
  const r = spawnSync('gh', ['api', `repos/${ghRepo.owner}/${ghRepo.repo}/releases?per_page=100`], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.status !== 0) return new Map()
  try {
    const list = JSON.parse(r.stdout) as GhRelease[]
    return new Map(list.filter(rel => !rel.draft).map(rel => [rel.tag_name, rel]))
  }
  catch {
    return new Map()
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const db = new DatabaseSync(join(root, 'data', 'gitview.db'))
const datesStmt = db.prepare('SELECT date FROM commits WHERE repo = ? ORDER BY date ASC')

const repos = discoverRepos(resolve(config.reposRoot))
const out: unknown[] = []

for (const repo of repos) {
  const tags = gitTags(repo.path)
  const remote = remoteOf(repo.path)
  const ghRepo = remote ? parseGitHub(remote) : null
  const ghMap = ghRepo ? ghReleases(ghRepo) : new Map<string, GhRelease>()

  // datas dos commits do repo (asc) — para contar commits entre tags
  const dates = (datesStmt.all(repo.name) as { date: string }[]).map(r => r.date)

  /** commits em (after, until] — as datas estão ordenadas, two-pointer simples */
  let cursor = 0
  const tagRows = tags.map((t) => {
    let count = 0
    while (cursor < dates.length && dates[cursor] <= t.date) {
      cursor++
      count++
    }
    const gh = ghMap.get(t.tag)
    return {
      tag: t.tag,
      date: t.date,
      commits: count,
      name: gh?.name ?? null,
      notes: gh?.body ? gh.body.slice(0, NOTES_MAX) : null,
      prerelease: gh?.prerelease ?? false,
      url: gh?.html_url ?? null,
    }
  })

  const unreleased = dates.length - cursor
  const webUrl = ghRepo ? `https://github.com/${ghRepo.owner}/${ghRepo.repo}` : null

  out.push({
    repo: repo.name,
    url: webUrl,
    unreleased,
    tags: tagRows.reverse(), // mais recente primeiro
  })
  console.log(`✓ ${repo.name}: ${tags.length} tags (${ghMap.size} com release no GitHub), ${unreleased} commits não liberados`)
}

db.close()

const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'releases.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  repos: out,
}))
console.log(`\n✓ releases.json gerado para ${out.length} repos`)
