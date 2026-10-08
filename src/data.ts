import { computed, reactive, ref } from 'vue'
import type { CommitRow, Stats } from './types'

export const stats = ref<Stats | null>(null)
export const loadError = ref<string | null>(null)

/** commits recentes (últimos 100/autor) — carregado sob demanda pela página do dev */
export const recentCommits = ref<CommitRow[] | null>(null)
export async function loadCommits() {
  if (recentCommits.value) return
  try {
    const res = await fetch('/data/commits.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    recentCommits.value = (await res.json()).commits
  }
  catch {
    recentCommits.value = []
  }
}

export const filters = reactive({
  repos: [] as string[],      // vazio = todos
  authors: [] as string[],    // vazio = todos
  rangeMonths: 12 as number | null, // null = todo o histórico
  showBots: false,
})

const botNames = computed(() => new Set((stats.value?.authors ?? []).filter(a => a.bot).map(a => a.name)))
export function isBot(author: string) {
  return botNames.value.has(author)
}

export async function loadStats() {
  try {
    const res = await fetch('/data/stats.json')
    if (!res.ok) throw new Error(`HTTP ${res.status} — rode "pnpm collect" primeiro`)
    stats.value = await res.json()
  }
  catch (err) {
    loadError.value = (err as Error).message
  }
}

function cutoffDate(): Date | null {
  if (filters.rangeMonths == null) return null
  const d = new Date()
  d.setMonth(d.getMonth() - filters.rangeMonths)
  return d
}

function inRange(periodKey: string): boolean {
  const cutoff = cutoffDate()
  if (!cutoff) return true
  // periodKey é "YYYY-Www" ou "YYYY-MM" — compara pelo começo do período
  return periodKey.slice(0, 7) >= `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
}

function selectedRepo(repo: string) {
  return filters.repos.length === 0 || filters.repos.includes(repo)
}
function selectedAuthor(author: string) {
  if (!filters.showBots && isBot(author)) return false
  return filters.authors.length === 0 || filters.authors.includes(author)
}

export const filteredWeekly = computed(() =>
  (stats.value?.weekly ?? []).filter(r => selectedRepo(r.repo) && selectedAuthor(r.author) && inRange(r.week)),
)

export const filteredMonthly = computed(() =>
  (stats.value?.monthly ?? []).filter(r => selectedRepo(r.repo) && selectedAuthor(r.author) && inRange(r.month)),
)

export const filteredHeatmap = computed(() =>
  (stats.value?.heatmap ?? []).filter(r => selectedRepo(r.repo) && selectedAuthor(r.author)),
)

/** commits no período filtrado (para cards) */
export const filteredCommitCount = computed(() =>
  filteredMonthly.value.reduce((acc, r) => acc + r.commits, 0),
)

/** label do período selecionado (navbar + cards) */
export const rangeLabel = computed(() => {
  if (filters.rangeMonths == null) return 'histórico completo'
  return filters.rangeMonths === 1 ? 'último mês' : `últimos ${filters.rangeMonths} meses`
})

/** totais do período filtrado (cards "no período") */
export const filteredTotals = computed(() => {
  let additions = 0
  let deletions = 0
  for (const r of filteredMonthly.value) {
    additions += r.additions
    deletions += r.deletions
  }
  return {
    commits: filteredCommitCount.value,
    additions,
    deletions,
    authors: commitsByAuthor.value.length,
    repos: commitsByRepo.value.length,
  }
})

/**
 * totais da janela ANTERIOR equivalente (ex.: 6M antes do cutoff de 6M),
 * para o delta dos cards. null quando o filtro é "tudo" (sem janela comparável).
 */
export const previousTotals = computed(() => {
  if (filters.rangeMonths == null || !stats.value) return null
  const cutoff = cutoffDate()!
  const prevStart = new Date(cutoff)
  prevStart.setMonth(prevStart.getMonth() - filters.rangeMonths)
  const prevKey = `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, '0')}`
  const cutKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`

  let commits = 0
  let additions = 0
  let deletions = 0
  const authors = new Set<string>()
  const repos = new Set<string>()
  for (const r of stats.value.monthly) {
    if (r.month < prevKey || r.month >= cutKey) continue
    if (!selectedRepo(r.repo) || !selectedAuthor(r.author)) continue
    commits += r.commits
    additions += r.additions
    deletions += r.deletions
    authors.add(r.author)
    repos.add(r.repo)
  }
  return { commits, additions, deletions, authors: authors.size, repos: repos.size }
})

/** tipos de commit (feat/fix/...) no filtro atual — aba Repositórios */
export const filteredTypes = computed(() =>
  (stats.value?.monthlyTypes ?? []).filter(r =>
    selectedRepo(r.repo) && selectedAuthor(r.author) && inRange(r.month),
  )
)

/** commits por repo no filtro atual (para o donut) */
export const commitsByRepo = computed(() => {
  const map = new Map<string, number>()
  for (const r of filteredMonthly.value) map.set(r.repo, (map.get(r.repo) ?? 0) + r.commits)
  return [...map.entries()].map(([repo, commits]) => ({ repo, commits })).sort((a, b) => b.commits - a.commits)
})

/** commits por autor no filtro atual */
export const commitsByAuthor = computed(() => {
  const map = new Map<string, number>()
  for (const r of filteredMonthly.value) map.set(r.author, (map.get(r.author) ?? 0) + r.commits)
  return [...map.entries()].map(([author, commits]) => ({ author, commits })).sort((a, b) => b.commits - a.commits)
})

// ---------------------------------------------------------------------------
// ritmo (últimas 4 semanas vs média das 8 anteriores) — ignora o filtro de período
// ---------------------------------------------------------------------------
function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const fday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 864e5))
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function lastNWeekKeys(n: number): string[] {
  const keys: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const back = new Date(d)
    back.setDate(back.getDate() - i * 7)
    keys.push(isoWeekKey(back))
  }
  return [...new Set(keys)]
}

export interface PaceRow {
  author: string
  recent: number      // commits nas últimas 4 semanas
  prevAvg: number     // média semanal das 8 semanas anteriores
  ratio: number | null // (recent/4) / prevAvg
}

export const pace = computed<PaceRow[]>(() => {
  const rows = (stats.value?.weekly ?? []).filter(r => selectedRepo(r.repo) && selectedAuthor(r.author))
  const byAuthor = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!byAuthor.has(r.author)) byAuthor.set(r.author, new Map())
    const m = byAuthor.get(r.author)!
    m.set(r.week, (m.get(r.week) ?? 0) + r.commits)
  }

  const weeks = lastNWeekKeys(12)
  const last4 = weeks.slice(-4)
  const prev8 = weeks.slice(0, 8)

  return [...byAuthor.entries()]
    .map(([author, m]) => {
      const recent = last4.reduce((s, w) => s + (m.get(w) ?? 0), 0)
      const prev = prev8.reduce((s, w) => s + (m.get(w) ?? 0), 0)
      const prevAvg = prev / 8
      return { author, recent, prevAvg, ratio: prevAvg > 0 ? recent / 4 / prevAvg : null }
    })
    .filter(r => r.prevAvg >= 2 || r.recent > 0)
    .sort((a, b) => (a.ratio ?? 0) - (b.ratio ?? 0))
})

// ---------------------------------------------------------------------------
// burnout watch — commits fora do horário (fds + madrugada), últimas 8 semanas
// ---------------------------------------------------------------------------
export interface BurnoutRow {
  author: string
  weekend: number        // commits sáb/dom nas últimas 8 sem
  night: number          // commits 22h–6h nas últimas 8 sem
  total: number          // commits totais nas últimas 8 sem
  offHoursPct: number    // (weekend + night) / total
  weekendsActive: number // dos últimos 4 fins de semana, em quantos commitou
}

export const burnout = computed<BurnoutRow[]>(() => {
  const rows = (stats.value?.weekly ?? []).filter(r => selectedRepo(r.repo) && selectedAuthor(r.author))
  const weeks = lastNWeekKeys(8)
  const last4 = new Set(weeks.slice(-4))
  const byAuthor = new Map<string, { weekend: number; night: number; total: number; weekendsActive: number }>()

  for (const r of rows) {
    if (!weeks.includes(r.week)) continue
    if (!byAuthor.has(r.author)) byAuthor.set(r.author, { weekend: 0, night: 0, total: 0, weekendsActive: 0 })
    const b = byAuthor.get(r.author)!
    b.weekend += r.weekend
    b.night += r.night
    b.total += r.commits
    if (last4.has(r.week) && r.weekend > 0) b.weekendsActive++
  }

  return [...byAuthor.entries()]
    .map(([author, b]) => ({
      author,
      ...b,
      offHoursPct: b.total > 0 ? (b.weekend + b.night) / b.total : 0,
    }))
    .filter(b => b.total > 0 && (b.weekend > 0 || b.night > 0))
    .sort((a, b) => (b.weekend + b.night) - (a.weekend + a.night))
})

// ---------------------------------------------------------------------------
// fora do horário no período filtrado (complemento do burnout, que é fixo em 8 sem)
// ---------------------------------------------------------------------------
export interface OffHoursRow {
  author: string
  total: number
  weekend: number
  night: number
  offHoursPct: number
}

export const offHoursPeriod = computed<OffHoursRow[]>(() => {
  const rows = (stats.value?.weekly ?? []).filter(r =>
    selectedRepo(r.repo) && selectedAuthor(r.author) && inRange(r.week),
  )
  const byAuthor = new Map<string, { total: number; weekend: number; night: number }>()
  for (const r of rows) {
    if (!byAuthor.has(r.author)) byAuthor.set(r.author, { total: 0, weekend: 0, night: 0 })
    const b = byAuthor.get(r.author)!
    b.total += r.commits
    b.weekend += r.weekend
    b.night += r.night
  }
  return [...byAuthor.entries()]
    .map(([author, b]) => ({ author, ...b, offHoursPct: b.total > 0 ? (b.weekend + b.night) / b.total : 0 }))
    .filter(b => b.total >= 20 && (b.weekend > 0 || b.night > 0))
    .sort((a, b) => b.offHoursPct - a.offHoursPct)
})
