/**
 * Coletor de estatísticas git multi-repo.
 *
 * 1. Descobre repos git dentro de `reposRoot` (config.json)
 * 2. Roda `git log --all --numstat` em cada um (streaming)
 * 3. Grava commits normalizados em data/gitview.db (node:sqlite nativo)
 * 4. Exporta agregados prontos em public/data/stats.json
 *
 * Re-rodar é incremental: INSERT OR IGNORE por (repo, hash).
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

interface Config {
  reposRoot: string
  exclude?: string[]
  /** Nome canônico -> lista de e-mails (alias) */
  authors?: Record<string, string[]>
}

const config = JSON.parse(readFileSync(join(root, 'config.json'), 'utf-8')) as Config

// ---------------------------------------------------------------------------
// descoberta de repos
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

// ---------------------------------------------------------------------------
// aliases de autor
// ---------------------------------------------------------------------------
const emailToCanonical = new Map<string, string>()
for (const [canonical, emails] of Object.entries(config.authors ?? {})) {
  for (const e of emails) emailToCanonical.set(e.toLowerCase(), canonical)
}
function canonicalAuthor(name: string, email: string): string {
  return emailToCanonical.get(email.toLowerCase()) ?? name.trim()
}

// ---------------------------------------------------------------------------
// bots (auto: nome termina com [bot]; extras via config.bots)
// ---------------------------------------------------------------------------
const configBots = new Set(((config as Config & { bots?: string[] }).bots ?? []).map(b => b.toLowerCase()))
function isBot(name: string): boolean {
  return /\[bot\]$/i.test(name.trim()) || configBots.has(name.toLowerCase())
}

// ---------------------------------------------------------------------------
// git log streaming
// ---------------------------------------------------------------------------
interface RawCommit {
  hash: string
  name: string
  email: string
  date: string
  subject: string
  additions: number
  deletions: number
}

function gitLog(repoPath: string): Promise<RawCommit[]> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', [
      '-C', repoPath,
      'log', '--all', '--no-renames',
      '--pretty=format:%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%s',
      '--numstat',
    ])
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => chunks.push(c))
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git log falhou em ${repoPath}: ${Buffer.concat(errChunks).toString()}`))
        return
      }
      resolvePromise(parseGitLog(Buffer.concat(chunks).toString('utf-8')))
    })
  })
}

function parseGitLog(raw: string): RawCommit[] {
  const commits: RawCommit[] = []
  // cada commit começa com \x1e (record separator)
  for (const block of raw.split('\x1e')) {
    if (!block.trim()) continue
    const lines = block.split('\n')
    const header = lines[0].split('\x1f')
    if (header.length < 5) continue
    const [hash, name, email, date, subject] = header
    let additions = 0
    let deletions = 0
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const parts = line.split('\t')
      if (parts.length < 3) continue
      const add = Number(parts[0])
      const del = Number(parts[1])
      if (Number.isFinite(add)) additions += add
      if (Number.isFinite(del)) deletions += del
    }
    commits.push({ hash, name, email, date, subject: subject ?? '', additions, deletions })
  }
  return commits
}

// ---------------------------------------------------------------------------
// banco
// ---------------------------------------------------------------------------
mkdirSync(join(root, 'data'), { recursive: true })
mkdirSync(join(root, 'public', 'data'), { recursive: true })

const db = new DatabaseSync(join(root, 'data', 'gitview.db'))
db.exec(`
  CREATE TABLE IF NOT EXISTS commits (
    repo TEXT NOT NULL,
    hash TEXT NOT NULL,
    author TEXT NOT NULL,
    email TEXT NOT NULL,
    date TEXT NOT NULL,
    subject TEXT NOT NULL,
    additions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (repo, hash)
  );
  CREATE INDEX IF NOT EXISTS idx_commits_date ON commits(date);
  CREATE INDEX IF NOT EXISTS idx_commits_author ON commits(author);
`)

const insert = db.prepare(`
  INSERT OR IGNORE INTO commits (repo, hash, author, email, date, subject, additions, deletions)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

// ---------------------------------------------------------------------------
// helpers de agregação
// ---------------------------------------------------------------------------
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (date.getUTCDay() + 6) % 7 // seg=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const fday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 864e5))
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function nextDayKey(dayKeyStr: string): string {
  const d = new Date(`${dayKeyStr}T00:00:00`)
  d.setDate(d.getDate() + 1)
  return dayKey(d)
}

/** streak atual (dias consecutivos terminando no último dia ativo) e recorde */
function calcStreaks(days: Set<string>): { streak: number; longestStreak: number } {
  const sorted = [...days].sort()
  let longest = 0
  let run = 0
  let prev = ''
  for (const d of sorted) {
    run = prev && nextDayKey(prev) === d ? run + 1 : 1
    if (run > longest) longest = run
    prev = d
  }
  return { streak: run, longestStreak: longest }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const repos = discoverRepos(resolve(config.reposRoot))
  console.log(`Repos encontrados: ${repos.length}`)
  repos.forEach(r => console.log(`  - ${r.name}`))

  for (const repo of repos) {
    const t0 = Date.now()
    let inTransaction = false
    try {
      const commits = await gitLog(repo.path)
      let inserted = 0
      db.exec('BEGIN')
      inTransaction = true
      for (const c of commits) {
        const res = insert.run(
          repo.name, c.hash, canonicalAuthor(c.name, c.email), c.email.toLowerCase(),
          c.date, c.subject.slice(0, 500), c.additions, c.deletions,
        )
        inserted += Number(res.changes)
      }
      db.exec('COMMIT')
      inTransaction = false
      console.log(`✓ ${repo.name}: ${commits.length} commits lidos, ${inserted} novos (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
    }
    catch (err) {
      if (inTransaction) db.exec('ROLLBACK')
      console.error(`✗ ${repo.name}: ${(err as Error).message}`)
    }
  }

  // re-normaliza autores já gravados caso os aliases tenham mudado no config
  const updateAuthor = db.prepare('UPDATE commits SET author = ? WHERE email = ? AND author != ?')
  for (const [email, canonical] of emailToCanonical) {
    updateAuthor.run(canonical, email, canonical)
  }

  // -------------------------------------------------------------------------
  // agregação -> stats.json
  // -------------------------------------------------------------------------
  console.log('\nAgregando...')
  const rows = db.prepare(`
    SELECT repo, author, email, date, additions, deletions FROM commits ORDER BY date ASC
  `).all() as { repo: string; author: string; email: string; date: string; additions: number; deletions: number }[]

  const emailsByAuthor = new Map<string, Set<string>>()
  const weekly = new Map<string, { commits: number; weekend: number; night: number }>() // week|repo|author
  const monthly = new Map<string, number>()     // month|repo|author
  const heatmap = new Map<string, number>()     // author|repo|weekday|hour
  const perAuthor = new Map<string, { commits: number; additions: number; deletions: number; repos: Set<string>; days: Set<string>; last: string }>()
  const perRepo = new Map<string, { commits: number; additions: number; deletions: number; authors: Set<string>; last: string }>()
  let totalAdd = 0
  let totalDel = 0
  const allDays = new Set<string>()

  for (const r of rows) {
    const d = new Date(r.date)
    if (Number.isNaN(d.getTime())) continue

    if (!emailsByAuthor.has(r.author)) emailsByAuthor.set(r.author, new Set())
    emailsByAuthor.get(r.author)!.add(r.email)

    const wk = `${isoWeekKey(d)}|${r.repo}|${r.author}`
    const wkCur = weekly.get(wk) ?? { commits: 0, weekend: 0, night: 0 }
    wkCur.commits++
    if (d.getDay() === 0 || d.getDay() === 6) wkCur.weekend++
    if (d.getHours() >= 22 || d.getHours() < 6) wkCur.night++
    weekly.set(wk, wkCur)

    const mk = `${monthKey(d)}|${r.repo}|${r.author}`
    monthly.set(mk, (monthly.get(mk) ?? 0) + 1)

    const hk = `${r.author}|${r.repo}|${d.getDay()}|${d.getHours()}`
    heatmap.set(hk, (heatmap.get(hk) ?? 0) + 1)

    const dk = dayKey(d)
    allDays.add(dk)

    if (!perAuthor.has(r.author)) perAuthor.set(r.author, { commits: 0, additions: 0, deletions: 0, repos: new Set(), days: new Set(), last: '' })
    const pa = perAuthor.get(r.author)!
    pa.commits++
    pa.additions += r.additions
    pa.deletions += r.deletions
    pa.repos.add(r.repo)
    pa.days.add(dk)
    if (r.date > pa.last) pa.last = r.date

    if (!perRepo.has(r.repo)) perRepo.set(r.repo, { commits: 0, additions: 0, deletions: 0, authors: new Set(), last: '' })
    const pr = perRepo.get(r.repo)!
    pr.commits++
    pr.additions += r.additions
    pr.deletions += r.deletions
    pr.authors.add(r.author)
    if (r.date > pr.last) pr.last = r.date

    totalAdd += r.additions
    totalDel += r.deletions
  }

  const stats = {
    generatedAt: new Date().toISOString(),
    repos: repos.map(r => r.name),
    authors: [...emailsByAuthor.entries()]
      .map(([name, emails]) => ({ name, emails: [...emails].sort(), bot: isBot(name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    totals: {
      commits: rows.length,
      additions: totalAdd,
      deletions: totalDel,
      activeDays: allDays.size,
      repos: repos.length,
      authors: perAuthor.size,
    },
    perRepo: [...perRepo.entries()]
      .map(([repo, v]) => ({ repo, commits: v.commits, additions: v.additions, deletions: v.deletions, authors: v.authors.size, lastCommit: v.last }))
      .sort((a, b) => b.commits - a.commits),
    perAuthor: [...perAuthor.entries()]
      .map(([author, v]) => ({ author, commits: v.commits, additions: v.additions, deletions: v.deletions, repos: v.repos.size, activeDays: v.days.size, lastCommit: v.last, ...calcStreaks(v.days) }))
      .sort((a, b) => b.commits - a.commits),
    weekly: [...weekly.entries()].map(([k, v]) => {
      const [week, repo, author] = k.split('|')
      return { week, repo, author, commits: v.commits, weekend: v.weekend, night: v.night }
    }),
    monthly: [...monthly.entries()].map(([k, commits]) => {
      const [month, repo, author] = k.split('|')
      return { month, repo, author, commits }
    }),
    heatmap: [...heatmap.entries()].map(([k, commits]) => {
      const [author, repo, weekday, hour] = k.split('|')
      return { author, repo, weekday: Number(weekday), hour: Number(hour), commits }
    }),
  }

  const out = join(root, 'public', 'data', 'stats.json')
  writeFileSync(out, JSON.stringify(stats))
  const kb = (JSON.stringify(stats).length / 1024).toFixed(0)
  console.log(`\nstats.json gerado (${kb} KB) com ${rows.length} commits de ${stats.totals.authors} autores em ${repos.length} repos.`)
  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
