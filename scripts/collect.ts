/**
 * Coletor de estatísticas git multi-repo.
 *
 * 1. Descobre repos git dentro de `reposRoot` (GITVIEW_REPOS_ROOT do .env/shell → data/repos)
 * 2. Roda `git log --all --no-merges --numstat` em cada um (streaming) — merges
 *    ficam fora de todas as métricas (decisão #7; retroativo via `pnpm clean`)
 * 3. Grava commits normalizados em data/gitview.db (node:sqlite nativo)
 * 4. Exporta agregados prontos em public/data/stats.json
 *
 * Re-rodar é incremental: INSERT OR IGNORE por (repo, hash).
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { loadConfig, resolveReposRoot } from './lib/config'
import { getToken, NO_TOKEN_HINT } from './lib/github'
import { denyPush, discoverRepos, fetchRepo, isManagedRepo, mapPool, parseGitHub, remoteOf, scrubPersistedToken } from './lib/repos'
import { resolveAliases } from './lib/team'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const config = loadConfig()

// ---------------------------------------------------------------------------
// aliases de autor (devProfiles do team.local.json)
// ---------------------------------------------------------------------------
const { emailToCanonical } = resolveAliases(config)
function canonicalAuthor(name: string, email: string): string {
  return emailToCanonical.get(email.toLowerCase()) ?? name.trim()
}

// ---------------------------------------------------------------------------
// bots (auto: nome termina com [bot]; extras via config.bots)
// ---------------------------------------------------------------------------
const configBots = new Set((config.bots ?? []).map(b => b.toLowerCase()))
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

/**
 * Normaliza a author date para UTC ISO com milis ('2026-10-08T18:05:13.000Z').
 * O %aI do git emite o offset original do autor (-03:00, Z…) e, gravado cru,
 * quebrava ordenação e comparação lexicográfica (releases/commits recentes).
 * O instante é preservado — buckets de hora/dia seguem no tz de quem coleta.
 */
function toUtcIso(date: string): string {
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? date : d.toISOString()
}

/**
 * Exclusão de arquivos gerados/lockfiles nas métricas de LINHAS — filtrada
 * linha a linha no numstat (não no pathspec do git log: pathspec também
 * removeria commits que só tocam lockfile, distorcendo contagens de commits,
 * releases e heatmaps). O commit entra; as linhas do arquivo gerado, não.
 * Nota: o numstat é somado no insert — pra reaplicar no histórico: pnpm clean.
 */
const EXCLUDE_PATTERNS = config.excludePaths ?? []

/** glob simples: '*' dentro do segmento; padrão com '/' casa o caminho todo (em qualquer profundidade), sem '/' casa o basename */
function matchesGlob(path: string, pattern: string): boolean {
  const body = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, ' ')
    .replace(/\*/g, '[^/]*')
    .replace(/ /g, '.*')
  const re = pattern.includes('/')
    ? new RegExp(`(^|.*/)${body}$`, 'i')
    : new RegExp(`^${body}$`, 'i')
  return re.test(pattern.includes('/') ? path : (path.split('/').pop() ?? path))
}

const isExcludedPath = (path: string): boolean => EXCLUDE_PATTERNS.some(p => matchesGlob(path, p))

function gitLog(repoPath: string, extraArgs: string[] = []): Promise<RawCommit[]> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', [
      '-C', repoPath,
      // --no-merges: commits de merge ficam fora de TODAS as métricas
      // (decisão issue #7 — inflavam commits/dia, ritmo e streaks com +0−0;
      // a "produção" do merge já está no PR). Retroativo: pnpm clean && pnpm collect.
      'log', '--all', '--no-renames', '--no-merges',
      '--pretty=format:%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%s',
      '--numstat',
      ...extraArgs,
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
      // linhas de arquivos gerados/lockfiles não somam (o commit entra igual)
      if (isExcludedPath(parts.slice(2).join('\t'))) continue
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

// migração: datas gravadas por versões antigas tinham o offset original do
// autor (-03:00, Z…), o que quebra comparação/ordenação lexicográfica —
// normaliza tudo para UTC ISO com milis (idempotente; instante preservado)
const migratedDates = db.prepare(`
  UPDATE commits SET date = strftime('%Y-%m-%dT%H:%M:%fZ', date)
  WHERE instr(date, '.') = 0 AND date GLOB '*T*'
`).run()
if (migratedDates.changes)
  console.log(`🔧 ${migratedDates.changes} datas normalizadas para UTC (formato antigo com offset)`)

// ---------------------------------------------------------------------------
// incremental: --since por repo a partir do watermark no banco (max date - margem).
// A margem cobre commits com committer date antiga mergeados depois do watermark;
// o INSERT OR IGNORE torna a sobreposição inócua. `--full` força re-scan completo.
// ---------------------------------------------------------------------------
const FULL = process.argv.includes('--full')
// --reaggregate: pula fetch + git log (nada novo entra) e só re-aplica aliases
// e re-exporta os JSONs — usado pela recoleta leve pós-edição de time (/teams)
const REAGGREGATE = process.argv.includes('--reaggregate')
const SINCE_MARGIN_DAYS = 7
const maxDateStmt = db.prepare('SELECT MAX(date) AS max FROM commits WHERE repo = ?')

function sinceArgs(repoName: string): string[] {
  if (FULL) return []
  const row = maxDateStmt.get(repoName) as { max: string | null }
  if (!row.max) return []
  const d = new Date(row.max)
  d.setDate(d.getDate() - SINCE_MARGIN_DAYS)
  return [`--since=${d.toISOString()}`]
}

// ---------------------------------------------------------------------------
// helpers de agregação
// ---------------------------------------------------------------------------
/**
 * Fuso canônico (issue #8): TODOS os buckets (dia/mês/ISO-semana/fim de
 * semana/madrugada/heatmap) são calculados em GITVIEW_TIMEZONE, nunca no
 * relógio da máquina que coleta — o mesmo banco produz os mesmos buckets em
 * qualquer máquina. Default: o fuso do time (São Paulo); UTC não modela a
 * "madrugada/fd" de ninguém na prática.
 */
const CANON_TZ = (() => {
  const tz = config.timezone ?? 'America/Sao_Paulo'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return tz
  }
  catch {
    console.warn(`! GITVIEW_TIMEZONE inválido ("${tz}") — caindo para America/Sao_Paulo`)
    return 'America/Sao_Paulo'
  }
})()

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CANON_TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', hour12: false,
})

interface Canon { y: number, m: number, d: number, h: number, weekday: number }

/** partes do calendário (ano/mês/dia/hora/dia-da-semana) da data no fuso canônico */
function canonParts(date: Date): Canon {
  const fp = partsFmt.formatToParts(date)
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(fp.find(p => p.type === type)?.value ?? '0')
  const y = num('year')
  const m = num('month')
  const d = num('day')
  const h = num('hour') % 24 // alguns engines devolvem 24 para meia-noite
  // dia da semana vem do CALENDÁRIO canônico (nunca do Date do fuso local)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return { y, m, d, h, weekday }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function isoWeekKeyOf(p: Canon): string {
  const date = new Date(Date.UTC(p.y, p.m - 1, p.d))
  const dayNum = (date.getUTCDay() + 6) % 7 // seg=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const fday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 864e5))
  return `${date.getUTCFullYear()}-W${pad2(week)}`
}

function isoWeekKey(d: Date): string {
  return isoWeekKeyOf(canonParts(d))
}

function monthKeyOf(p: Canon): string {
  return `${p.y}-${pad2(p.m)}`
}

function monthKey(d: Date): string {
  return monthKeyOf(canonParts(d))
}

function dayKeyOf(p: Canon): string {
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`
}

function dayKey(d: Date): string {
  return dayKeyOf(canonParts(d))
}

function nextDayKey(dayKeyStr: string): string {
  // aritmética calendária pura em UTC (nunca Date local — atravessa DST/TZ da
  // máquina e quebraria streaks na mesma data vista de fusos diferentes)
  const [y, m, d] = dayKeyStr.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + 86_400_000)
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
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
// tipo do commit pelo prefixo conventional commits (feat/fix/chore/...)
// ---------------------------------------------------------------------------
const KNOWN_TYPES = new Set(['feat', 'fix', 'chore', 'refactor', 'docs', 'test', 'perf', 'style', 'build', 'ci'])
function commitType(subject: string): string {
  const m = subject.match(/^([a-zA-Z]+)(\([^)]*\))?!?:/)
  if (!m) return 'outros'
  const t = m[1].toLowerCase()
  return KNOWN_TYPES.has(t) ? t : 'outros'
}

/** remote origin -> URL web https (para link de commit); null se não for GitHub */
function repoWebUrl(path: string): string | null {
  const remote = remoteOf(path)
  const gh = remote ? parseGitHub(remote) : null
  return gh ? `https://github.com/${gh.owner}/${gh.repo}` : null
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const repos = discoverRepos(resolveReposRoot(config), config.exclude ?? [])
  console.log(`Repos encontrados: ${repos.length}`)
  repos.forEach(r => console.log(`  - ${r.name}`))

  // clones gerenciados (data/repos) não têm dono que dê pull — atualiza aqui.
  // denyPush é idempotente: garante a trava read-only também em clones antigos.
  // scrubPersistedToken apaga o extraheader que versões antigas gravavam no
  // clone (token em repouso) — o fetch agora injeta o token só no processo.
  const managed = repos.filter(r => isManagedRepo(r.path))
  if (managed.length && !REAGGREGATE) {
    const token = getToken()?.token
    if (!token) console.warn(`! ${NO_TOKEN_HINT} — fetch dos clones vai usar só o cache local`)
    console.log(`\nAtualizando ${managed.length} clones gerenciados (git fetch)...`)
    await mapPool(managed, 4, async (repo) => {
      denyPush(repo.path)
      scrubPersistedToken(repo.path)
      const err = await fetchRepo(repo.path, token)
      if (err) console.warn(`! ${repo.name}: fetch falhou, usando cache local (${err.split('\n')[0]})`)
    })
  }

  console.log(FULL ? 'Modo: completo (--full)' : REAGGREGATE ? 'Modo: reagregação (--reaggregate, sem git)' : 'Modo: incremental (--since por repo)')

  // repos que saíram da seleção (setup refeito, exclude, etc.) somem do banco —
  // se voltarem um dia, o watermark vazio força re-scan completo deles
  if (repos.length) {
    const placeholders = repos.map(() => '?').join(',')
    const pruned = db.prepare(`DELETE FROM commits WHERE repo NOT IN (${placeholders})`).run(...repos.map(r => r.name))
    if (pruned.changes) console.log(`🧹 ${pruned.changes} commits removidos de repos fora da seleção`)
  }

  if (!REAGGREGATE)
    await mapPool(repos, 4, async (repo) => {
      const t0 = Date.now()
      let inTransaction = false
      try {
        const commits = await gitLog(repo.path, sinceArgs(repo.name))
        let inserted = 0
        db.exec('BEGIN')
        inTransaction = true
        for (const c of commits) {
          const res = insert.run(
            repo.name, c.hash, canonicalAuthor(c.name, c.email), c.email.toLowerCase(),
            toUtcIso(c.date), c.subject.slice(0, 500), c.additions, c.deletions,
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
    })

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
    SELECT repo, author, email, date, subject, additions, deletions FROM commits ORDER BY date ASC
  `).all() as { repo: string; author: string; email: string; date: string; subject: string; additions: number; deletions: number }[]

  const emailsByAuthor = new Map<string, Set<string>>()
  const weekly = new Map<string, { commits: number; weekend: number; night: number }>() // week|repo|author
  const monthly = new Map<string, { commits: number; additions: number; deletions: number }>() // month|repo|author
  const monthlyTypes = new Map<string, number>() // month|repo|author|type
  const heatmap = new Map<string, number>()     // author|repo|month|weekday|hour
  // heatmap ganha dimensão de mês pro filtro de período funcionar no frontend;
  // limita aos últimos 24 meses (cobre o maior range do filtro) pra não inflar o JSON
  const heatmapCutoff = new Date()
  // setUTC* em vez de local: o corte é de instantes; local addiria ruído de
  // fuso no limiar (o monthKey do resultado continua canônico)
  heatmapCutoff.setUTCMonth(heatmapCutoff.getUTCMonth() - 24)
  const heatmapCutoffKey = monthKey(heatmapCutoff)
  const perAuthor = new Map<string, { commits: number; additions: number; deletions: number; repos: Set<string>; days: Set<string>; last: string }>()
  const perRepo = new Map<string, { commits: number; additions: number; deletions: number; authors: Set<string>; last: string }>()
  let totalAdd = 0
  let totalDel = 0
  const allDays = new Set<string>()

  for (const r of rows) {
    const d = new Date(r.date)
    if (Number.isNaN(d.getTime())) continue
    const cp = canonParts(d) // uma única vez por linha — todos os buckets vêm dela
    const month = monthKeyOf(cp)

    if (!emailsByAuthor.has(r.author)) emailsByAuthor.set(r.author, new Set())
    emailsByAuthor.get(r.author)!.add(r.email)

    const wk = `${isoWeekKeyOf(cp)}|${r.repo}|${r.author}`
    const wkCur = weekly.get(wk) ?? { commits: 0, weekend: 0, night: 0 }
    wkCur.commits++
    if (cp.weekday === 0 || cp.weekday === 6) wkCur.weekend++
    if (cp.h >= 22 || cp.h < 6) wkCur.night++
    weekly.set(wk, wkCur)

    const mk = `${month}|${r.repo}|${r.author}`
    const mCur = monthly.get(mk) ?? { commits: 0, additions: 0, deletions: 0 }
    mCur.commits++
    mCur.additions += r.additions
    mCur.deletions += r.deletions
    monthly.set(mk, mCur)

    const tk = `${mk}|${commitType(r.subject)}`
    monthlyTypes.set(tk, (monthlyTypes.get(tk) ?? 0) + 1)

    if (month >= heatmapCutoffKey) {
      const hk = `${r.author}|${r.repo}|${month}|${cp.weekday}|${cp.h}`
      heatmap.set(hk, (heatmap.get(hk) ?? 0) + 1)
    }

    const dk = dayKeyOf(cp)
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
    repoUrls: Object.fromEntries(
      repos.map(r => [r.name, repoWebUrl(r.path)]).filter(([, url]) => url != null),
    ),
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
    monthly: [...monthly.entries()].map(([k, v]) => {
      const [month, repo, author] = k.split('|')
      return { month, repo, author, commits: v.commits, additions: v.additions, deletions: v.deletions }
    }),
    heatmap: [...heatmap.entries()].map(([k, commits]) => {
      const [author, repo, month, weekday, hour] = k.split('|')
      return { author, repo, month, weekday: Number(weekday), hour: Number(hour), commits }
    }),
    monthlyTypes: [...monthlyTypes.entries()].map(([k, commits]) => {
      const [month, repo, author, type] = k.split('|')
      return { month, repo, author, type, commits }
    }),
  }

  const out = join(root, 'public', 'data', 'stats.json')
  writeFileSync(out, JSON.stringify(stats))
  const kb = (JSON.stringify(stats).length / 1024).toFixed(0)
  console.log(`\nstats.json gerado (${kb} KB) com ${rows.length} commits de ${stats.totals.authors} autores em ${repos.length} repos.`)

  // commits recentes por autor (página de perfil do dev) — últimos 100 de cada
  const recent = db.prepare(`
    SELECT repo, hash, author, date, subject, additions, deletions FROM commits ORDER BY date DESC
  `).all() as { repo: string; hash: string; author: string; date: string; subject: string; additions: number; deletions: number }[]
  const perAuthorCount = new Map<string, number>()
  const recentCommits = []
  for (const c of recent) {
    const n = perAuthorCount.get(c.author) ?? 0
    if (n >= 100) continue
    perAuthorCount.set(c.author, n + 1)
    recentCommits.push({
      hash: c.hash.slice(0, 7),
      repo: c.repo,
      author: c.author,
      date: c.date,
      message: c.subject,
      additions: c.additions,
      deletions: c.deletions,
    })
  }
  writeFileSync(join(root, 'public', 'data', 'commits.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    commits: recentCommits,
  }))
  console.log(`commits.json gerado com ${recentCommits.length} commits recentes.`)
  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
