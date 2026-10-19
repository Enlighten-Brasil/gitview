// scripts/make-demo-data.ts — fixture sintético da demo pública (GitHub Pages)
//
// Gera os 5 JSONs de public/data/ com dados 100% FICTÍCIOS (devs "Ana"/"Beto",
// repos demo-*, commits fake) para a demo servir sem nenhum dado real do time.
// As datas se ancoram em "hoje" (UTC) de propósito: a demo sempre cobre o
// período default de 12M — o custo é o fixture não ser byte-idêntico entre dias.
// Segurança: recusa-se a sobrescrever dados existentes sem --force.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { getOrCreate } from '../src/collections'

const OUT = join(process.cwd(), 'public', 'data')
const FORCE = process.argv.includes('--force')

const TARGETS = ['stats.json', 'commits.json', 'github.json', 'releases.json', 'team.json']
if (!FORCE) {
  const existing = TARGETS.filter(f => existsSync(join(OUT, f)))
  if (existing.length) {
    console.error(`make-demo-data: recusando sobrescrever dados existentes (${existing.join(', ')}) — use --force`)
    process.exit(1)
  }
}

// PRNG determinístico (mulberry32) — mesma entrada, mesma saída
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261016)
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.000Z`
const isoNoMs = (d: Date) => iso(d).replace('.000Z', 'Z')
const dayKey = (d: Date) => iso(d).slice(0, 10)
const monthKey = (d: Date) => iso(d).slice(0, 7)
function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const day = (t.getUTCDay() + 6) % 7 // segunda = 0
  t.setUTCDate(t.getUTCDate() - day + 3) // quinta da semana ISO
  const year = t.getUTCFullYear()
  const firstThu = new Date(Date.UTC(year, 0, 4))
  const fday = (firstThu.getUTCDay() + 6) % 7
  firstThu.setUTCDate(firstThu.getUTCDate() - fday + 3)
  const week = 1 + Math.round((t.getTime() - firstThu.getTime()) / (7 * 864e5))
  return `${year}-W${pad(week)}`
}

// Mundo fictício
const DEVS = [
  { name: 'Ana', emails: ['ana@example.com'], login: 'ana' },
  { name: 'Beto', emails: ['beto@example.com'], login: 'beto' },
]
const REPOS = [
  { repo: 'demo-api', url: 'https://github.com/example/demo-api' },
  { repo: 'demo-web', url: 'https://github.com/example/demo-web' },
]
const MESSAGES: Array<[string, string]> = [
  ['feat: novo endpoint de pedidos', 'feat'],
  ['fix: corrige paginação da listagem', 'fix'],
  ['chore: atualiza dependências', 'outros'],
  ['docs: documenta a API pública', 'docs'],
  ['feat: tela de relatórios', 'feat'],
  ['fix: timezone do agrupamento semanal', 'fix'],
  ['refactor: extrai serviço de autenticação', 'outros'],
]

interface Commit {
  hash: string
  repo: string
  author: string
  date: string
  message: string
  additions: number
  deletions: number
  type: string
  weekend: number
  night: number
  /** escopo de ref (issue #119) — no JSON viaja omit-prod (campo só quando ≠ 'prod') */
  scope: 'prod' | 'integration' | 'branch'
}

const commits: Commit[] = []
const usedHashes = new Set<string>()
const now = new Date()
for (let back = 89; back >= 0; back--) {
  const perDay = rnd() < 0.45 ? 0 : (rnd() < 0.7 ? 1 : 2)
  for (let i = 0; i < perDay; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back, 9 + Math.floor(rnd() * (rnd() < 0.12 ? 15 : 10)), Math.floor(rnd() * 60)))
    let hash = ''
    do {
      hash = Math.floor(rnd() * 0xFFFFFFF).toString(16).padStart(7, '0')
    } while (usedHashes.has(hash))
    usedHashes.add(hash)
    const [message, type] = pick(MESSAGES)
    const author = rnd() < 0.6 ? 'Ana' : 'Beto'
    const repo = rnd() < 0.55 ? 'demo-api' : 'demo-web'
    const hour = d.getUTCHours()
    // escopo de ref (issue #119): só trabalho RECENTE está em progresso — ~12%
    // dos últimos 21 dias são integration/branch (PRNG determinístico); o resto
    // é prod (campo omitido no JSON, encoding omit-prod)
    const scopeRoll = rnd()
    const scope: Commit['scope'] = back <= 20 && scopeRoll < 0.07
      ? 'integration'
      : back <= 20 && scopeRoll < 0.12
        ? 'branch'
        : 'prod'
    commits.push({
      hash,
      repo,
      author,
      date: iso(d),
      message,
      additions: 5 + Math.floor(rnd() * 400),
      deletions: Math.floor(rnd() * 150),
      type,
      weekend: (d.getUTCDay() === 0 || d.getUTCDay() === 6) ? 1 : 0,
      night: (hour >= 22 || hour < 5) ? 1 : 0,
      scope,
    })
  }
}
commits.sort((a, b) => (a.date === b.date ? (a.hash < b.hash ? 1 : -1) : (a.date < b.date ? 1 : -1))) // desc, hash como desempate

// agregados derivados da MESMA lista — invariantes valem por construção
const totals = {
  commits: commits.length,
  prodCommits: commits.filter(c => c.scope === 'prod').length,
  progressCommits: commits.filter(c => c.scope !== 'prod').length,
  additions: commits.reduce((a, c) => a + c.additions, 0),
  deletions: commits.reduce((a, c) => a + c.deletions, 0),
  activeDays: new Set(commits.map(c => dayKey(new Date(c.date)))).size,
  repos: REPOS.length,
  authors: DEVS.length,
}

function streaksFor(author: string) {
  const days = [...new Set(commits.filter(c => c.author === author).map(c => dayKey(new Date(c.date))))].sort()
  let longest = 0
  let cur = 0
  let prev: number | null = null
  for (const k of days) {
    const t = Date.parse(`${k}T00:00:00Z`)
    cur = (prev !== null && t - prev === 864e5) ? cur + 1 : 1
    longest = Math.max(longest, cur)
    prev = t
  }
  const last = days[days.length - 1]
  let streak = 0
  let cursor = Date.parse(`${last}T00:00:00Z`)
  const set = new Set(days.map(k => Date.parse(`${k}T00:00:00Z`)))
  while (set.has(cursor)) {
    streak++
    cursor -= 864e5
  }
  return { streak, longestStreak: longest }
}

const perRepo = REPOS.map(({ repo }) => {
  const rows = commits.filter(c => c.repo === repo)
  return {
    repo,
    commits: rows.length,
    prodCommits: rows.filter(c => c.scope === 'prod').length,
    progressCommits: rows.filter(c => c.scope !== 'prod').length,
    additions: rows.reduce((a, c) => a + c.additions, 0),
    deletions: rows.reduce((a, c) => a + c.deletions, 0),
    authors: new Set(rows.map(c => c.author)).size,
    // rows sempre tem commits (cada repo do demo gera os seus) — `?? ''` só pro tipo
    lastCommit: rows.map(c => c.date).sort().at(-1) ?? '',
  }
})

const perAuthor = DEVS.map(({ name }) => {
  const rows = commits.filter(c => c.author === name)
  const { streak, longestStreak } = streaksFor(name)
  return {
    author: name,
    commits: rows.length,
    additions: rows.reduce((a, c) => a + c.additions, 0),
    deletions: rows.reduce((a, c) => a + c.deletions, 0),
    repos: new Set(rows.map(c => c.repo)).size,
    activeDays: new Set(rows.map(c => dayKey(new Date(c.date)))).size,
    lastCommit: rows.map(c => c.date).sort().at(-1) ?? '',
    streak,
    longestStreak,
  }
})

function groupBy<T>(rows: Commit[], keyFn: (c: Commit) => string, mapFn: (c: Commit, rows: Commit[]) => T): T[] {
  const map = new Map<string, Commit[]>()
  for (const c of rows) {
    getOrCreate(map, keyFn(c), () => []).push(c)
  }
  return [...map.entries()].map(([, rs]) => mapFn(rs[0], rs))
}

const weekly = groupBy(commits, c => `${isoWeekKey(new Date(c.date))}|${c.repo}|${c.author}|${c.scope}`, (c, rs) => ({
  week: isoWeekKey(new Date(c.date)),
  repo: c.repo,
  author: c.author,
  ...(c.scope === 'prod' ? {} : { scope: c.scope }),
  commits: rs.length,
  weekend: rs.reduce((a, r) => a + r.weekend, 0),
  night: rs.reduce((a, r) => a + r.night, 0),
}))

const monthly = groupBy(commits, c => `${monthKey(new Date(c.date))}|${c.repo}|${c.author}|${c.scope}`, (c, rs) => ({
  month: monthKey(new Date(c.date)),
  repo: c.repo,
  author: c.author,
  ...(c.scope === 'prod' ? {} : { scope: c.scope }),
  commits: rs.length,
  additions: rs.reduce((a, r) => a + r.additions, 0),
  deletions: rs.reduce((a, r) => a + r.deletions, 0),
}))

const heatmap = groupBy(commits, c => `${c.author}|${c.repo}|${monthKey(new Date(c.date))}|${new Date(c.date).getUTCDay()}|${new Date(c.date).getUTCHours()}|${c.scope}`, (c, rs) => ({
  author: c.author,
  repo: c.repo,
  month: monthKey(new Date(c.date)),
  weekday: new Date(c.date).getUTCDay(),
  hour: new Date(c.date).getUTCHours(),
  ...(c.scope === 'prod' ? {} : { scope: c.scope }),
  commits: rs.length,
}))

const monthlyTypes = groupBy(commits, c => `${monthKey(new Date(c.date))}|${c.repo}|${c.author}|${c.scope}|${c.type}`, (c, rs) => ({
  month: monthKey(new Date(c.date)),
  repo: c.repo,
  author: c.author,
  ...(c.scope === 'prod' ? {} : { scope: c.scope }),
  type: c.type,
  commits: rs.length,
}))

const generatedAt = iso(new Date())

const stats = {
  generatedAt,
  repos: REPOS.map(r => r.repo),
  repoUrls: Object.fromEntries(REPOS.map(r => [r.repo, r.url])),
  authors: DEVS.map(d => ({ name: d.name, emails: d.emails, bot: false })),
  totals,
  perRepo,
  perAuthor,
  weekly,
  monthly,
  heatmap,
  monthlyTypes,
}

const commitsJson = {
  generatedAt,
  // amostra com a mesma codificação omit-prod do coletor real (issue #119)
  commits: commits.slice(0, 100).map(({ hash, repo, author, date, message, additions, deletions, scope }) => ({ hash, repo, author, date, message, additions, deletions, ...(scope === 'prod' ? {} : { scope }) })),
}

// PRs fictícios — invariantes: MERGED tem mergedAt, sem repo#number duplicado
const day = (back: number, hour: number) => isoNoMs(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back, hour, 12)))
const prs = [
  { repo: 'demo-api', number: 12, title: 'feat: endpoint de pedidos', state: 'MERGED', draft: false, author: 'ana', createdAt: day(70, 13), mergedAt: day(68, 15), additions: 240, deletions: 18, changedFiles: 6, reviews: [{ author: 'beto', state: 'APPROVED', submittedAt: day(69, 10) }] },
  { repo: 'demo-api', number: 15, title: 'fix: paginação da listagem', state: 'MERGED', draft: false, author: 'beto', createdAt: day(50, 9), mergedAt: day(49, 11), additions: 60, deletions: 22, changedFiles: 3, reviews: [{ author: 'ana', state: 'APPROVED', submittedAt: day(49, 10) }] },
  { repo: 'demo-api', number: 18, title: 'chore: atualiza dependências', state: 'MERGED', draft: false, author: 'ana', createdAt: day(30, 14), mergedAt: day(30, 16), additions: 120, deletions: 110, changedFiles: 2, reviews: [] },
  { repo: 'demo-api', number: 21, title: 'feat: relatório de faturamento', state: 'OPEN', draft: true, author: 'beto', createdAt: day(4, 10), mergedAt: null, additions: 310, deletions: 5, changedFiles: 8, reviews: [] },
  { repo: 'demo-web', number: 7, title: 'feat: tela de relatórios', state: 'MERGED', draft: false, author: 'beto', createdAt: day(40, 11), mergedAt: day(37, 17), additions: 520, deletions: 40, changedFiles: 11, reviews: [{ author: 'ana', state: 'APPROVED', submittedAt: day(38, 9) }, { author: 'beto', state: 'COMMENTED', submittedAt: day(38, 8) }] },
  { repo: 'demo-web', number: 9, title: 'fix: timezone do agrupamento semanal', state: 'MERGED', draft: false, author: 'ana', createdAt: day(20, 8), mergedAt: day(19, 12), additions: 45, deletions: 30, changedFiles: 4, reviews: [{ author: 'beto', state: 'APPROVED', submittedAt: day(19, 11) }] },
  { repo: 'demo-web', number: 11, title: 'refactor: serviço de autenticação', state: 'OPEN', draft: false, author: 'ana', createdAt: day(2, 15), mergedAt: null, additions: 180, deletions: 140, changedFiles: 7, reviews: [{ author: 'beto', state: 'CHANGES_REQUESTED', submittedAt: day(1, 9) }] },
]

const github = {
  generatedAt,
  users: Object.fromEntries(DEVS.map(d => [d.login, { name: d.name, bot: false }])),
  prs,
}

// releases: unreleased + Σtags.commits == commits do repo (invariante do check-data)
const releases = {
  generatedAt,
  repos: REPOS.map(({ repo, url }) => {
    const total = commits.filter(c => c.repo === repo).length
    const tag1 = Math.floor(total * 0.3)
    const tag2 = Math.floor(total * 0.4)
    return {
      repo,
      url,
      unreleased: total - tag1 - tag2,
      tags: [
        { tag: 'v1.1.0', date: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 25, 12, 0))), commits: tag2, name: 'v1.1.0', notes: '## v1.1.0\n\n- melhorias da demo' },
        { tag: 'v1.0.0', date: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 60, 12, 0))), commits: tag1, name: 'v1.0.0', notes: '## v1.0.0\n\n- release inicial da demo' },
      ],
    }
  }),
}

const team = {
  generatedAt,
  devs: DEVS.map(d => ({ name: d.name, title: null, description: null, emails: d.emails, githubLogins: [d.login], teams: ['Plataforma'], bot: false })),
  teams: [{ name: 'Plataforma', description: 'Time da demo', color: '#7c5cff', members: DEVS.map(d => d.name) }],
  candidates: [],
}

mkdirSync(OUT, { recursive: true })
for (const [name, data] of Object.entries({ 'stats.json': stats, 'commits.json': commitsJson, 'github.json': github, 'releases.json': releases, 'team.json': team }))
  writeFileSync(join(OUT, name), `${JSON.stringify(data, null, 2)}\n`)

console.log(`make-demo-data: 5 arquivos gerados em ${OUT} (${commits.length} commits fictícios, ${prs.length} PRs)`)
