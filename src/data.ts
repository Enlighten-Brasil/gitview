import type { CommitRow, Stats } from './types'
import { computed } from 'vue'
import { authorSelected, cutoff, filters, inPeriodMonth, isCustomRange, repoSelected } from './filters-core'
import { defineLoader } from './loader'
import { OFF_HOURS_MIN_COMMITS } from './thresholds'

// núcleo dos filtros (estado + predicados) reexportado daqui: os consumidores
// continuam importando de ./data, a implementação vive em ./filters-core (issue #39)
export {
  authorSelected,
  cutoff,
  filters,
  inPeriodDay,
  inPeriodMonth,
  isCustomRange,
  repoSelected,
} from './filters-core'

// loader do stats.json — a mensagem do HTTP não-OK carrega a instrução de coleta
const statsLoader = defineLoader<Stats>('stats.json', {
  httpError: status => `HTTP ${status} — rode "pnpm collect" primeiro`,
})
export const stats = statsLoader.data
export const loadError = statsLoader.error
export const loadStats = statsLoader.load

/** commits recentes (últimos 100/autor) — carregado sob demanda pela página do dev */
const commitsLoader = defineLoader<CommitRow[]>('commits.json', {
  pick: json => (json as { commits: CommitRow[] }).commits,
  // falha engolida (sem mensagem): a página do dev mostra a lista vazia
  onErrorValue: [],
})
export const recentCommits = commitsLoader.data
export const loadCommits = commitsLoader.load

// ---------------------------------------------------------------------------
// ações nomeadas dos filtros — única porta de escrita do estado (o urlState
// também escreve ao sincronizar a URL); componentes/páginas nunca mutam o
// `filters` diretamente (issue #39)
// ---------------------------------------------------------------------------
/** (des)marca num preset de lista — utilitário das ações de seleção */
function toggleList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(v => v !== value) : [...list, value]
}

/** preset de período (meses; null = tudo) — limpa o range customizado */
export function setRange(months: number | null): void {
  filters.dateFrom = null
  filters.dateTo = null
  filters.rangeMonths = months
}

/** datas do range customizado (YYYY-MM-DD) — quando preenchidas, valem sobre o preset */
export function setCustomRange(from: string | null, to: string | null): void {
  filters.dateFrom = from || null
  filters.dateTo = to || null
}

/** alterna o modo custom: ativa pré-preenchido com a janela atual, desativa limpando */
export function toggleCustomRange(): void {
  if (isCustomRange()) {
    setCustomRange(null, null)
    return
  }
  const from = new Date()
  if (filters.rangeMonths != null)
    from.setMonth(from.getMonth() - filters.rangeMonths)
  else
    from.setFullYear(from.getFullYear() - 10)
  setCustomRange(from.toISOString().slice(0, 10), new Date().toISOString().slice(0, 10))
}

/** inclui/esconder bots nas métricas */
export function setShowBots(show: boolean): void {
  filters.showBots = show
}

/** (des)marca um repo na seleção */
export function toggleRepo(repo: string): void {
  filters.repos = toggleList(filters.repos, repo)
}

/** substitui a seleção de repos */
export function setRepos(repos: string[]): void {
  filters.repos = [...repos]
}

/** (des)marca um autor na seleção */
export function toggleAuthor(author: string): void {
  filters.authors = toggleList(filters.authors, author)
}

/** substitui a seleção de autores */
export function setAuthors(authors: string[]): void {
  filters.authors = [...authors]
}

/** chip de time: (des)marca todos os membros de uma vez */
export function toggleTeam(members: string[]): void {
  const all = members.every(m => filters.authors.includes(m))
  filters.authors = all
    ? filters.authors.filter(a => !members.includes(a))
    : [...new Set([...filters.authors, ...members])]
}

/** trava os autores exatamente nos membros (escopo 'team': /teams/:name) */
export function lockAuthors(members: string[]): void {
  filters.authors = [...members]
}

/** limpa a seleção de repos + autores */
export function resetSelection(): void {
  filters.repos = []
  filters.authors = []
}

const botNames = computed(() => new Set((stats.value?.authors ?? []).filter(a => a.bot).map(a => a.name)))
export function isBot(author: string) {
  return botNames.value.has(author)
}

export const filteredWeekly = computed(() =>
  (stats.value?.weekly ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && inPeriodMonth(r.week)),
)

export const filteredMonthly = computed(() =>
  (stats.value?.monthly ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && inPeriodMonth(r.month)),
)

export const filteredHeatmap = computed(() =>
  (stats.value?.heatmap ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && inPeriodMonth(r.month)),
)

/** commits no período filtrado (para cards) */
export const filteredCommitCount = computed(() =>
  filteredMonthly.value.reduce((acc, r) => acc + r.commits, 0),
)

/** label do período selecionado (navbar + cards) */
export const rangeLabel = computed(() => {
  if (isCustomRange()) {
    const f = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).toLocaleDateString('pt-BR') : 'início'
    const t = filters.dateTo ? new Date(`${filters.dateTo}T00:00:00`).toLocaleDateString('pt-BR') : 'hoje'
    return `${f} → ${t}`
  }
  if (filters.rangeMonths == null)
    return 'histórico completo'
  return filters.rangeMonths === 1 ? 'último mês' : `últimos ${filters.rangeMonths} meses`
})

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
  // sem janela comparável quando o filtro é "tudo" ou range customizado
  if (filters.rangeMonths == null || isCustomRange() || !stats.value)
    return null
  const cut = cutoff()!
  const prevStart = new Date(cut)
  prevStart.setMonth(prevStart.getMonth() - filters.rangeMonths)
  const prevKey = `${prevStart.getFullYear()}-${String(prevStart.getMonth() + 1).padStart(2, '0')}`
  const cutKey = `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}`

  let commits = 0
  let additions = 0
  let deletions = 0
  const authors = new Set<string>()
  const repos = new Set<string>()
  for (const r of stats.value.monthly) {
    if (r.month < prevKey || r.month >= cutKey)
      continue
    if (!repoSelected(r.repo) || !authorSelected(r.author, isBot(r.author)))
      continue
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
    repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && inPeriodMonth(r.month),
  ),
)

// ---------------------------------------------------------------------------
// ritmo (últimas 4 semanas vs média das 8 anteriores) — ignora o filtro de período
// ---------------------------------------------------------------------------
/** chave ISO "YYYY-Www" (segunda a domingo) — usada também pelo resumo semanal */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const fday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 864e5))
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** segunda UTC da semana ISO "YYYY-Www" (inverso de isoWeekKey; null se o formato não bate) */
function isoWeekMonday(key: string): Date | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key)
  if (!m)
    return null
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4))
  const dayNum = (jan4.getUTCDay() + 6) % 7 // 0 = segunda
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - dayNum + (Number(m[2]) - 1) * 7)
  return monday
}

/**
 * chave da semana ISO `n` semanas calendário antes de `key` — aritmética pura
 * (não depende de a semana ter dados). Usada por janelas de baseline: semanas
 * vazias contam como 0 em vez de esticar a janela além das N calendárias.
 */
export function isoWeekKeyBefore(key: string, n: number): string | null {
  const monday = isoWeekMonday(key)
  if (!monday)
    return null
  monday.setUTCDate(monday.getUTCDate() - n * 7)
  return isoWeekKey(monday)
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
  recent: number // commits nas últimas 4 semanas
  prevAvg: number // média semanal das 8 semanas anteriores
  ratio: number | null // (recent/4) / prevAvg
}

export const pace = computed<PaceRow[]>(() => {
  const rows = (stats.value?.weekly ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)))
  const byAuthor = new Map<string, Map<string, number>>()
  for (const r of rows) {
    if (!byAuthor.has(r.author))
      byAuthor.set(r.author, new Map())
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
  weekend: number // commits sáb/dom nas últimas 8 sem
  night: number // commits 22h–6h nas últimas 8 sem
  total: number // commits totais nas últimas 8 sem
  offHoursPct: number // (weekend + night) / total
  weekendsActive: number // dos últimos 4 fins de semana, em quantos commitou
}

export const burnout = computed<BurnoutRow[]>(() => {
  const rows = (stats.value?.weekly ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)))
  const weeks = lastNWeekKeys(8)
  const last4 = new Set(weeks.slice(-4))
  const byAuthor = new Map<string, { weekend: number, night: number, total: number, weekendsActive: number }>()

  for (const r of rows) {
    if (!weeks.includes(r.week))
      continue
    if (!byAuthor.has(r.author))
      byAuthor.set(r.author, { weekend: 0, night: 0, total: 0, weekendsActive: 0 })
    const b = byAuthor.get(r.author)!
    b.weekend += r.weekend
    b.night += r.night
    b.total += r.commits
    if (last4.has(r.week) && r.weekend > 0)
      b.weekendsActive++
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
    repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && inPeriodMonth(r.week),
  )
  const byAuthor = new Map<string, { total: number, weekend: number, night: number }>()
  for (const r of rows) {
    if (!byAuthor.has(r.author))
      byAuthor.set(r.author, { total: 0, weekend: 0, night: 0 })
    const b = byAuthor.get(r.author)!
    b.total += r.commits
    b.weekend += r.weekend
    b.night += r.night
  }
  return [...byAuthor.entries()]
    .map(([author, b]) => ({ author, ...b, offHoursPct: b.total > 0 ? (b.weekend + b.night) / b.total : 0 }))
    .filter(b => b.total >= OFF_HOURS_MIN_COMMITS && (b.weekend > 0 || b.night > 0))
    .sort((a, b) => b.offHoursPct - a.offHoursPct)
})
