/**
 * Coletor de releases (complemento do collect.ts / collect-github.ts).
 *
 * 1. Tags git locais (`git tag` com data) — cobertura universal, sem API
 * 2. Releases do GitHub via API REST (token do .env) — enriquece a tag com nome, notas e URL
 * 3. Conta commits por release (desde a tag anterior) e commits não liberados
 *    (desde a última tag) usando o data/gitview.db
 *
 * Saída: public/data/releases.json — o frontend continua 100% estático.
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { loadConfig, resolveReposRoot } from './lib/config'
import { getToken, ghApiAll } from './lib/github'
import { discoverRepos, mapPool, parseGitHub, remoteOf } from './lib/repos'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/** notas de release truncadas nesse tamanho (o link pro GitHub tem o resto) */
const NOTES_MAX = 3000

const config = loadConfig()
const auth = getToken()

// ---------------------------------------------------------------------------
// tags locais: nome + data (iso8601 estrito é parseável por new Date)
// ---------------------------------------------------------------------------
interface Tag { tag: string, date: string }

function gitTags(repoPath: string): Tag[] {
  const r = spawnSync('git', [
    '-C',
    repoPath,
    'tag',
    '--sort=creatordate',
    '--format=%(refname:short)%09%(creatordate:iso8601-strict)',
  ], { encoding: 'utf-8' })
  if (r.status !== 0)
    return []
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
// releases do GitHub (notas/nome/url) — REST paginado (100/página)
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

async function ghReleases(ghRepo: { owner: string, repo: string }): Promise<Map<string, GhRelease>> {
  // sem token, o repo sai só com as tags git (comportamento histórico); com
  // token, falha de API é AVISADA — não engolida em silêncio (issue #6)
  if (!auth)
    return new Map()
  try {
    const list = await ghApiAll<GhRelease>(`/repos/${ghRepo.owner}/${ghRepo.repo}/releases`, auth.token)
    return new Map(list.filter(rel => !rel.draft).map(rel => [rel.tag_name, rel]))
  }
  catch (err) {
    console.warn(`! ${ghRepo.owner}/${ghRepo.repo}: releases do GitHub indisponíveis (${(err as Error).message}) — saindo só com as tags git`)
    return new Map<string, GhRelease>()
  }
}

/** map assíncrono com concorrência limitada (repos em paralelo) — scripts/lib/repos.ts */

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const db = new DatabaseSync(join(root, 'data', 'gitview.db'))
const datesStmt = db.prepare('SELECT date FROM commits WHERE repo = ? ORDER BY date ASC')

const repos = discoverRepos(resolveReposRoot(config), config.exclude ?? [])
const out: unknown[] = []
// ordem de saída estável mesmo com o processamento paralelo
const byRepo = new Map<string, unknown>()

await mapPool(repos, 4, async (repo) => {
  const tags = gitTags(repo.path)
  const remote = remoteOf(repo.path)
  const ghRepo = remote ? parseGitHub(remote) : null
  const ghMap = ghRepo ? await ghReleases(ghRepo) : new Map<string, GhRelease>()

  // datas dos commits do repo (asc) — para contar commits entre tags.
  // Compara por timestamp (epoch): datas gravadas antes da normalização UTC
  // tinham offsets mistos e a comparação lexicográfica atribuía commits à tag
  // errada (ex.: '2026-01-23T21:06:42Z' > '2026-01-23T22:00:00-03:00' como texto)
  const dates = (datesStmt.all(repo.name) as { date: string }[])
    .map(r => new Date(r.date).getTime())
    .filter(t => Number.isFinite(t))
    .sort((a, b) => a - b)

  /** commits em (after, until] — timestamps ordenados, two-pointer simples */
  let cursor = 0
  const tagRows = tags.map((t) => {
    let count = 0
    const tagMs = new Date(t.date).getTime()
    while (cursor < dates.length && dates[cursor] <= tagMs) {
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

  byRepo.set(repo.name, {
    repo: repo.name,
    url: webUrl,
    unreleased,
    tags: tagRows.reverse(), // mais recente primeiro
  })
  console.log(`✓ ${repo.name}: ${tags.length} tags (${ghMap.size} com release no GitHub), ${unreleased} commits não liberados`)
})

for (const repo of repos) out.push(byRepo.get(repo.name))

db.close()

const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'releases.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  repos: out,
}))
console.log(`\n✓ releases.json gerado para ${out.length} repos`)
