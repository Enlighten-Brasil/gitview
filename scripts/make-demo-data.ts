// scripts/make-demo-data.ts — fixture sintético da demo pública (GitHub Pages)
//
// Gera os 10 JSONs de public/data/ com dados 100% FICTÍCIOS (devs "Ana"/"Beto",
// repos demo-*, commits fake) para a demo servir sem nenhum dado real do time:
// os 8 fixos + graph-demo-api/demo-web (topologia do grafo de commits, #146).
// As linhas perAuthor levam byScope derivado dos mesmos commits (#164) e os
// graph-*.json órfãos de public/data são apagados antes da escrita (#164).
// As datas se ancoram em "hoje" (UTC) de propósito: a demo sempre cobre o
// período default de 12M — o custo é o fixture não ser byte-idêntico entre dias.
// Segurança: recusa-se a sobrescrever dados existentes sem --force.
import type { GraphCommit, GraphData, ReportCommitRow, ReportCommitsData } from '../src/types'
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { getOrCreate } from '../src/collections'
import { compareReportCommitRows } from '../src/report-commits'

const OUT = join(process.cwd(), 'public', 'data')
const FORCE = process.argv.includes('--force')

const TARGETS = ['stats.json', 'daily.json', 'commits.json', 'report-commits.json', 'github.json', 'branches.json', 'releases.json', 'team.json', 'graph-demo-api.json', 'graph-demo-web.json']
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
      hash = Array.from({ length: 5 }, () => Math.floor(rnd() * 0x100000000).toString(16).padStart(8, '0')).join('')
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

function streaksFor(rows: Commit[]) {
  const days = [...new Set(rows.map(c => dayKey(new Date(c.date))))].sort()
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

/** medidas de uma linha perAuthor (integral) ou de um eixo byScope (issue #164) */
function measuresFor(rows: Commit[]) {
  const { streak, longestStreak } = streaksFor(rows)
  return {
    commits: rows.length,
    additions: rows.reduce((a, c) => a + c.additions, 0),
    deletions: rows.reduce((a, c) => a + c.deletions, 0),
    repos: new Set(rows.map(c => c.repo)).size,
    activeDays: new Set(rows.map(c => dayKey(new Date(c.date)))).size,
    lastCommit: rows.map(c => c.date).sort().at(-1) ?? '',
    streak,
    longestStreak,
  }
}

// byScope (issue #164): eixos prod/progress derivados dos MESMOS commits da
// linha — os invariantes do check-data (#152) valem por construção: os
// aditivos somam a linha (partição por scope), dias/repos do eixo são
// subconjuntos dos da linha e o longestStreak do eixo é um run dos dias dela
const perAuthor = DEVS.map(({ name }) => {
  const rows = commits.filter(c => c.author === name)
  return {
    author: name,
    ...measuresFor(rows),
    byScope: {
      prod: measuresFor(rows.filter(c => c.scope === 'prod')),
      progress: measuresFor(rows.filter(c => c.scope !== 'prod')),
    },
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

// daily.json (issue #175): agregado dia-preciso derivado dos MESMOS commits —
// chave dia|repo|autor|scope e predicados de weekend/night idênticos aos do
// weekly (campo pré-computado em Commit), então os invariantes contra o
// stats.json (Σcommits/prod/progress/additions/deletions e Σweekend/Σnight vs
// weekly) valem por construção
const daily = groupBy(commits, c => `${dayKey(new Date(c.date))}|${c.repo}|${c.author}|${c.scope}`, (c, rs) => ({
  day: dayKey(new Date(c.date)),
  repo: c.repo,
  author: c.author,
  ...(c.scope === 'prod' ? {} : { scope: c.scope }),
  commits: rs.length,
  additions: rs.reduce((a, r) => a + r.additions, 0),
  deletions: rs.reduce((a, r) => a + r.deletions, 0),
  weekend: rs.reduce((a, r) => a + r.weekend, 0),
  night: rs.reduce((a, r) => a + r.night, 0),
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
  commits: commits.slice(0, 100).map(({ hash, repo, author, date, message, additions, deletions, scope }) => ({ hash: hash.slice(0, 7), repo, author, date, message, additions, deletions, ...(scope === 'prod' ? {} : { scope }) })),
}

const dailyJson = { generatedAt, daily }
const reportRows: ReportCommitRow[] = commits.map(({ hash, repo, author, date, message, additions, deletions, scope }) => ({
  hash,
  repo,
  author,
  date,
  day: dayKey(new Date(date)),
  message,
  additions,
  deletions,
  ...(scope === 'prod' ? {} : { scope }),
}))
const reportCommitsJson: ReportCommitsData = {
  generatedAt,
  commits: reportRows.sort(compareReportCommitRows),
}

// PRs fictícios — invariantes: MERGED tem mergedAt, sem repo#number duplicado
const day = (back: number, hour: number) => isoNoMs(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back, hour, 12)))
// tip/headRefOid fictício determinístico (40-hex, único por nome): char codes em hex
function fakeTip(name: string): string {
  let h = ''
  for (const ch of name)
    h += ch.charCodeAt(0).toString(16).padStart(2, '0')
  return h.repeat(Math.ceil(40 / Math.max(h.length, 1))).slice(0, 40)
}
const prs = [
  { repo: 'demo-api', number: 12, title: 'feat: endpoint de pedidos', state: 'MERGED', draft: false, author: 'ana', createdAt: day(70, 13), mergedAt: day(68, 15), additions: 240, deletions: 18, changedFiles: 6, headRef: 'feat/order-endpoint', baseRef: 'main', headRefOid: fakeTip('feat/order-endpoint'), reviews: [{ author: 'beto', state: 'APPROVED', submittedAt: day(69, 10) }] },
  { repo: 'demo-api', number: 15, title: 'fix: paginação da listagem', state: 'MERGED', draft: false, author: 'beto', createdAt: day(50, 9), mergedAt: day(49, 11), additions: 60, deletions: 22, changedFiles: 3, headRef: 'fix/list-pagination', baseRef: 'main', headRefOid: fakeTip('fix/list-pagination'), reviews: [{ author: 'ana', state: 'APPROVED', submittedAt: day(49, 10) }] },
  { repo: 'demo-api', number: 18, title: 'chore: atualiza dependências', state: 'MERGED', draft: false, author: 'ana', createdAt: day(30, 14), mergedAt: day(30, 16), additions: 120, deletions: 110, changedFiles: 2, headRef: 'chore/deps-update', baseRef: 'main', headRefOid: fakeTip('chore/deps-update'), reviews: [] },
  { repo: 'demo-api', number: 21, title: 'feat: relatório de faturamento', state: 'OPEN', draft: true, author: 'beto', createdAt: day(4, 10), mergedAt: null, additions: 310, deletions: 5, changedFiles: 8, headRef: 'feat/billing-report', baseRef: 'main', headRefOid: fakeTip('feat/billing-report'), reviews: [] },
  { repo: 'demo-web', number: 7, title: 'feat: tela de relatórios', state: 'MERGED', draft: false, author: 'beto', createdAt: day(40, 11), mergedAt: day(37, 17), additions: 520, deletions: 40, changedFiles: 11, headRef: 'feat/reports-screen', baseRef: 'main', headRefOid: fakeTip('feat/reports-screen'), reviews: [{ author: 'ana', state: 'APPROVED', submittedAt: day(38, 9) }, { author: 'beto', state: 'COMMENTED', submittedAt: day(38, 8) }] },
  { repo: 'demo-web', number: 9, title: 'fix: timezone do agrupamento semanal', state: 'MERGED', draft: false, author: 'ana', createdAt: day(20, 8), mergedAt: day(19, 12), additions: 45, deletions: 30, changedFiles: 4, headRef: 'fix/weekly-grouping-tz', baseRef: 'main', headRefOid: fakeTip('fix/weekly-grouping-tz'), reviews: [{ author: 'beto', state: 'APPROVED', submittedAt: day(19, 11) }] },
  { repo: 'demo-web', number: 11, title: 'refactor: serviço de autenticação', state: 'OPEN', draft: false, author: 'ana', createdAt: day(2, 15), mergedAt: null, additions: 180, deletions: 140, changedFiles: 7, headRef: 'refactor/auth-service', baseRef: 'main', headRefOid: fakeTip('refactor/auth-service'), reviews: [{ author: 'beto', state: 'CHANGES_REQUESTED', submittedAt: day(1, 9) }] },
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

// branches.json (issue #123): inventário coerente com os PRs acima — os headRefs
// dos PRs existem como branches (menos chore/deps-update, apagada após squash:
// headRef sobrevive no PR), com os 5 status cobertos. demo-web não tem develop
// (aheadInt/behindInt nulos). authorsAhead leva e-mail CRU (fato puramente git).
const branches = {
  generatedAt,
  repos: [
    {
      repo: 'demo-api',
      productionRef: 'main',
      integrationRefs: ['develop'],
      branches: [
        { name: 'main', tip: fakeTip('main'), lastActivity: day(1, 12), aheadProd: 0, behindProd: 0, aheadInt: 0, behindInt: 4, authorsAhead: [], additions: 0, deletions: 0, status: 'production' },
        { name: 'develop', tip: fakeTip('develop'), lastActivity: day(1, 10), aheadProd: 4, behindProd: 0, aheadInt: 0, behindInt: 0, authorsAhead: ['ana@example.com', 'beto@example.com'], additions: 320, deletions: 45, status: 'integration' },
        { name: 'feat/order-endpoint', tip: fakeTip('feat/order-endpoint'), lastActivity: day(69, 14), aheadProd: 0, behindProd: 96, aheadInt: 0, behindInt: 12, authorsAhead: [], additions: 0, deletions: 0, status: 'pousada' },
        { name: 'fix/list-pagination', tip: fakeTip('fix/list-pagination'), lastActivity: day(50, 8), aheadProd: 0, behindProd: 74, aheadInt: 0, behindInt: 9, authorsAhead: [], additions: 0, deletions: 0, status: 'pousada' },
        { name: 'feat/billing-report', tip: fakeTip('feat/billing-report'), lastActivity: day(3, 17), aheadProd: 6, behindProd: 3, aheadInt: 6, behindInt: 0, authorsAhead: ['beto@example.com'], additions: 310, deletions: 5, status: 'feature' },
        { name: 'dependabot/npm_and_yarn/axios', tip: fakeTip('dependabot/npm_and_yarn/axios'), lastActivity: day(10, 6), aheadProd: 1, behindProd: 12, aheadInt: 1, behindInt: 12, authorsAhead: ['support@dependabot.com'], additions: 84, deletions: 22, status: 'bot' },
      ],
    },
    {
      repo: 'demo-web',
      productionRef: 'main',
      integrationRefs: [],
      branches: [
        { name: 'main', tip: fakeTip('main-web'), lastActivity: day(2, 9), aheadProd: 0, behindProd: 0, aheadInt: null, behindInt: null, authorsAhead: [], additions: 0, deletions: 0, status: 'production' },
        { name: 'feat/reports-screen', tip: fakeTip('feat/reports-screen'), lastActivity: day(38, 11), aheadProd: 0, behindProd: 58, aheadInt: null, behindInt: null, authorsAhead: [], additions: 0, deletions: 0, status: 'pousada' },
        { name: 'fix/weekly-grouping-tz', tip: fakeTip('fix/weekly-grouping-tz'), lastActivity: day(20, 8), aheadProd: 0, behindProd: 21, aheadInt: null, behindInt: null, authorsAhead: [], additions: 0, deletions: 0, status: 'feature' },
        { name: 'refactor/auth-service', tip: fakeTip('refactor/auth-service'), lastActivity: day(2, 15), aheadProd: 9, behindProd: 2, aheadInt: null, behindInt: null, authorsAhead: ['ana@example.com'], additions: 180, deletions: 140, status: 'feature' },
        { name: 'renovate/vue', tip: fakeTip('renovate/vue'), lastActivity: day(5, 3), aheadProd: 1, behindProd: 4, aheadInt: null, behindInt: null, authorsAhead: ['bot@renovateapp.com'], additions: 12, deletions: 12, status: 'bot' },
      ],
    },
  ],
}

// ---------------------------------------------------------------------------
// graph-demo-*.json (issue #146): topologia de commits por repo demo, no shape
// do contrato do coletor (#126 — GraphData em src/types.ts). A seção #grafo de
// /repos/:name sai do empty-state com um desenho que demonstra: lanes com
// junções de merge (2-3 por repo, ambos os pais dentro da janela), EXATAMENTE
// 1 aresta clipada por repo (parent fora da janela — o renderer desenha
// tracejada com o marcador "continua") e chips de refs (decoration %D nos tips
// das branches do branches.json acima + tags do releases.json).
//
// Hashes 40-hex consistentes (esquema fakeTip): tips de branches/PRs usam
// fakeTip(nome) — o MESMO valor já emitido em branches.json (tip) e nos PRs
// (headRefOid); commits internos usam fakeTip("<repo>:<id>"). O parent fora da
// janela referencia um id que NÃO está entre os seeds: o hash sintético não
// aparece no array commits — exatamente o que o renderer detecta como aresta
// clipada. `window` = contagem de commits: o corte é autoconsistente (o walk
// "esgotou a janela" no commit mais antigo, cuja mãe ficou de fora).
// ---------------------------------------------------------------------------

/** seed de um commit do grafo demo — `parents` referenciam ids de outros seeds */
interface GraphSeed {
  id: string
  /** 40-hex pronto p/ tips que devem bater com branches.json/PRs (fakeTip do ref) */
  hash?: string
  /** dias atrás de hoje (UTC); hora/minuto UTC */
  back: number
  hour: number
  min?: number
  author: string
  subject: string
  /** itens de decoration no formato %D ('HEAD -> main', 'tag: v1.0.0'); sem refs = omitir */
  refs?: string[]
  /** ids dos pais na ordem do git (1º = primeira mãe); id desconhecido = fora da janela */
  parents: string[]
}

function graphFor(repo: string, seeds: GraphSeed[]): GraphData {
  const hashOf = new Map<string, string>()
  for (const s of seeds)
    hashOf.set(s.id, s.hash ?? fakeTip(`${repo}:${s.id}`))
  // id ausente dos seeds (o 'pre' da commit mais antigo) = parent fora da janela
  const h = (id: string): string => hashOf.get(id) ?? fakeTip(`${repo}:${id}`)
  const rows: GraphCommit[] = seeds.map(s => ({
    hash: h(s.id),
    parents: s.parents.map(h),
    author: s.author,
    date: iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - s.back, s.hour, s.min ?? 0))),
    subject: s.subject,
    refs: s.refs ?? [],
  }))
  // contrato: ordem descendente por timestamp, sort estável (padrão collect-graph.ts)
  rows.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  return { generatedAt, repo, window: rows.length, commits: rows }
}

// demo-api: espinha main com 3 merges (develop + PRs #12/#15), o squash do
// PR #18 (branch apagada — só o commit no main), tags nas datas do releases,
// branch ativa do PR #21 (draft), branch do dependabot e as 2 pousadas.
const graphDemoApi = graphFor('demo-api', [
  // — espinha do main (cadeia de primeira mãe), mais recente → mais antiga —
  { id: 'a0', hash: fakeTip('main'), back: 1, hour: 12, author: 'Ana', subject: 'feat: tela de relatórios', refs: ['HEAD -> main'], parents: ['a1'] },
  { id: 'a1', back: 3, hour: 15, author: 'Beto', subject: 'fix: corrige paginação da listagem', parents: ['a2'] },
  { id: 'a2', back: 9, hour: 10, author: 'Ana', subject: 'docs: documenta a API pública', parents: ['a3'] },
  { id: 'a3', back: 17, hour: 9, author: 'Beto', subject: 'refactor: extrai serviço de autenticação', parents: ['t11'] },
  { id: 't11', back: 25, hour: 12, author: 'Ana', subject: 'chore: release v1.1.0', refs: ['tag: v1.1.0'], parents: ['a4'] },
  { id: 'a4', back: 28, hour: 10, author: 'Ana', subject: 'feat: novo endpoint de pedidos', parents: ['mdev'] },
  { id: 'mdev', back: 29, hour: 17, author: 'Beto', subject: 'Merge branch develop', parents: ['sq18', 'd4'] },
  { id: 'sq18', back: 30, hour: 16, author: 'Ana', subject: 'chore: atualiza dependências', parents: ['a5'] },
  { id: 'a5', back: 38, hour: 14, author: 'Beto', subject: 'fix: timezone do agrupamento semanal', parents: ['mpr15'] },
  { id: 'mpr15', back: 49, hour: 11, author: 'Ana', subject: 'Merge pull request #15 from fix/list-pagination', parents: ['a6', 'p0'] },
  { id: 'a6', back: 56, hour: 10, author: 'Beto', subject: 'feat: novo endpoint de pedidos', parents: ['t10'] },
  { id: 't10', back: 60, hour: 12, author: 'Ana', subject: 'chore: release v1.0.0', refs: ['tag: v1.0.0'], parents: ['mpr12'] },
  { id: 'mpr12', back: 68, hour: 15, author: 'Ana', subject: 'Merge pull request #12 from feat/order-endpoint', parents: ['a7', 'o0'] },
  { id: 'a7', back: 76, hour: 11, author: 'Beto', subject: 'docs: documenta a API pública', parents: ['slast'] },
  { id: 'slast', back: 85, hour: 9, author: 'Ana', subject: 'feat: novo endpoint de pedidos', parents: ['pre'] },
  // — develop (4 commits à frente do main, como no branches.json): junta no 'mdev' —
  { id: 'd0', hash: fakeTip('develop'), back: 1, hour: 10, author: 'Beto', subject: 'fix: corrige paginação da listagem', refs: ['develop'], parents: ['d1'] },
  { id: 'd1', back: 9, hour: 15, author: 'Ana', subject: 'feat: novo endpoint de pedidos', parents: ['d2'] },
  { id: 'd2', back: 16, hour: 11, author: 'Beto', subject: 'docs: documenta a API pública', parents: ['d3'] },
  { id: 'd3', back: 24, hour: 9, author: 'Ana', subject: 'fix: timezone do agrupamento semanal', parents: ['d4'] },
  { id: 'd4', back: 33, hour: 10, author: 'Beto', subject: 'feat: tela de relatórios', parents: ['a5'] },
  // — feat/billing-report (PR #21, draft aberto): 6 à frente / 3 atrás —
  { id: 'f0', hash: fakeTip('feat/billing-report'), back: 3, hour: 17, author: 'Beto', subject: 'feat: relatório de faturamento', refs: ['feat/billing-report'], parents: ['f1'] },
  { id: 'f1', back: 6, hour: 10, author: 'Beto', subject: 'feat: tela de relatórios', parents: ['f2'] },
  { id: 'f2', back: 10, hour: 15, author: 'Beto', subject: 'fix: corrige paginação da listagem', parents: ['f3'] },
  { id: 'f3', back: 12, hour: 11, author: 'Ana', subject: 'feat: novo endpoint de pedidos', parents: ['f4'] },
  { id: 'f4', back: 14, hour: 9, author: 'Beto', subject: 'docs: documenta a API pública', parents: ['f5'] },
  { id: 'f5', back: 16, hour: 13, author: 'Beto', subject: 'feat: novo endpoint de pedidos', parents: ['a3'] },
  // — dependabot (1 à frente): curva para a espinha no 'a3' —
  { id: 'b0', hash: fakeTip('dependabot/npm_and_yarn/axios'), back: 10, hour: 6, author: 'Beto', subject: 'chore: atualiza dependências', refs: ['dependabot/npm_and_yarn/axios'], parents: ['a3'] },
  // — pousadas (PRs #12/#15 mergeados): tips com refs, como no branches.json —
  { id: 'o0', hash: fakeTip('feat/order-endpoint'), back: 69, hour: 14, author: 'Ana', subject: 'feat: novo endpoint de pedidos', refs: ['feat/order-endpoint'], parents: ['o1'] },
  { id: 'o1', back: 71, hour: 10, author: 'Ana', subject: 'fix: corrige paginação da listagem', parents: ['a7'] },
  { id: 'p0', hash: fakeTip('fix/list-pagination'), back: 50, hour: 8, author: 'Beto', subject: 'fix: corrige paginação da listagem', refs: ['fix/list-pagination'], parents: ['p1'] },
  { id: 'p1', back: 53, hour: 14, author: 'Beto', subject: 'feat: tela de relatórios', parents: ['a6'] },
])

// demo-web: espinha main com 2 merges (PRs #7/#9), tags, a branch longa do
// PR #11 (aberto, 9 à frente / 2 atrás), renovate (1 à frente) e as pousadas.
const graphDemoWeb = graphFor('demo-web', [
  // — espinha do main —
  { id: 'w0', hash: fakeTip('main-web'), back: 2, hour: 9, author: 'Ana', subject: 'fix: timezone do agrupamento semanal', refs: ['HEAD -> main'], parents: ['w1'] },
  { id: 'w1', back: 8, hour: 14, author: 'Beto', subject: 'feat: tela de relatórios', parents: ['w2'] },
  { id: 'w2', back: 14, hour: 10, author: 'Ana', subject: 'docs: documenta a API pública', parents: ['mw9'] },
  { id: 'mw9', back: 19, hour: 12, author: 'Ana', subject: 'Merge pull request #9 from fix/weekly-grouping-tz', parents: ['wt11', 'tz0'] },
  { id: 'wt11', back: 25, hour: 12, author: 'Beto', subject: 'chore: release v1.1.0', refs: ['tag: v1.1.0'], parents: ['w3'] },
  { id: 'w3', back: 28, hour: 11, author: 'Ana', subject: 'refactor: extrai serviço de autenticação', parents: ['mw7'] },
  { id: 'mw7', back: 37, hour: 17, author: 'Beto', subject: 'Merge pull request #7 from feat/reports-screen', parents: ['w4', 'rs0'] },
  { id: 'w4', back: 48, hour: 9, author: 'Ana', subject: 'feat: novo endpoint de pedidos', parents: ['wt10'] },
  { id: 'wt10', back: 60, hour: 12, author: 'Beto', subject: 'chore: release v1.0.0', refs: ['tag: v1.0.0'], parents: ['w5'] },
  { id: 'w5', back: 66, hour: 13, author: 'Ana', subject: 'fix: corrige paginação da listagem', parents: ['wlast'] },
  { id: 'wlast', back: 71, hour: 10, author: 'Beto', subject: 'chore: atualiza dependências', parents: ['pre'] },
  // — fix/weekly-grouping-tz (PR #9, mergeado): junta no 'mw9' —
  { id: 'tz0', hash: fakeTip('fix/weekly-grouping-tz'), back: 20, hour: 8, author: 'Ana', subject: 'fix: timezone do agrupamento semanal', refs: ['fix/weekly-grouping-tz'], parents: ['tz1'] },
  { id: 'tz1', back: 24, hour: 9, author: 'Ana', subject: 'feat: tela de relatórios', parents: ['w3'] },
  // — feat/reports-screen (PR #7, mergeado): junta no 'mw7' —
  { id: 'rs0', hash: fakeTip('feat/reports-screen'), back: 38, hour: 11, author: 'Beto', subject: 'feat: tela de relatórios', refs: ['feat/reports-screen'], parents: ['rs1'] },
  { id: 'rs1', back: 43, hour: 15, author: 'Beto', subject: 'docs: documenta a API pública', parents: ['rs2'] },
  { id: 'rs2', back: 46, hour: 10, author: 'Ana', subject: 'feat: novo endpoint de pedidos', parents: ['w4'] },
  // — refactor/auth-service (PR #11 aberto): 9 à frente / 2 atrás do main —
  { id: 'r0', hash: fakeTip('refactor/auth-service'), back: 2, hour: 15, author: 'Ana', subject: 'refactor: extrai serviço de autenticação', refs: ['refactor/auth-service'], parents: ['r1'] },
  { id: 'r1', back: 3, hour: 11, author: 'Ana', subject: 'fix: corrige paginação da listagem', parents: ['r2'] },
  { id: 'r2', back: 5, hour: 9, author: 'Ana', subject: 'feat: novo endpoint de pedidos', parents: ['r3'] },
  { id: 'r3', back: 6, hour: 15, author: 'Ana', subject: 'docs: documenta a API pública', parents: ['r4'] },
  { id: 'r4', back: 8, hour: 10, author: 'Ana', subject: 'feat: tela de relatórios', parents: ['r5'] },
  { id: 'r5', back: 9, hour: 16, author: 'Ana', subject: 'fix: timezone do agrupamento semanal', parents: ['r6'] },
  { id: 'r6', back: 11, hour: 9, author: 'Ana', subject: 'refactor: extrai serviço de autenticação', parents: ['r7'] },
  { id: 'r7', back: 12, hour: 14, author: 'Ana', subject: 'chore: atualiza dependências', parents: ['r8'] },
  { id: 'r8', back: 13, hour: 10, author: 'Ana', subject: 'feat: novo endpoint de pedidos', parents: ['w2'] },
  // — renovate (1 à frente): colapsa na espinha no merge 'mw9' —
  { id: 'v0', hash: fakeTip('renovate/vue'), back: 5, hour: 3, author: 'Beto', subject: 'chore: atualiza dependências', refs: ['renovate/vue'], parents: ['mw9'] },
])

mkdirSync(OUT, { recursive: true })
// graph-*.json órfãos (issue #164): sob um public/data com graphs reais
// pré-existentes, os não-demo sobravam e o check:data avisava "repo ausente do
// stats.json#repos". Apaga TODOS antes de gravar: os demo são regravados abaixo
for (const f of readdirSync(OUT).filter(f => /^graph-.+\.json$/.test(f)))
  rmSync(join(OUT, f))
for (const [name, data] of Object.entries({ 'stats.json': stats, 'daily.json': dailyJson, 'commits.json': commitsJson, 'report-commits.json': reportCommitsJson, 'github.json': github, 'branches.json': branches, 'releases.json': releases, 'team.json': team, 'graph-demo-api.json': graphDemoApi, 'graph-demo-web.json': graphDemoWeb }))
  writeFileSync(join(OUT, name), `${JSON.stringify(data, null, 2)}\n`)

const demoBranches = branches.repos.reduce((n, r) => n + r.branches.length, 0)
const demoGraphCommits = graphDemoApi.commits.length + graphDemoWeb.commits.length
console.log(`make-demo-data: 10 arquivos gerados em ${OUT} (${commits.length} commits fictícios, ${daily.length} linhas dia×repo×autor, ${prs.length} PRs, ${demoBranches} branches, ${demoGraphCommits} commits de grafo)`)
