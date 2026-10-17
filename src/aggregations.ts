/**
 * Agregações de negócio (issue #41) — as somas por mês/autor/repo que antes
 * estavam reescritas em 8+ computeds de componentes, num lugar só. Helpers
 * puros (`groupBySum`/`nestBySum` + as agregações nomeadas) recebem linhas
 * JÁ FILTRADAS pelo chamador; os computeds do fim do módulo consomem as
 * projeções filtradas do ./filters. O data.ts reexporta tudo.
 */
import type { MonthlyRow, MonthlyTypeRow, WeeklyRow } from './types'
import { computed } from 'vue'
import { lastNWeekKeys } from './date'
import { filteredCommitCount, filteredMonthly, filteredWeekly, isBot, stats } from './filters'
import { authorSelected, cutoff, filters, isCustomRange, repoSelected } from './filters-core'
import { OFF_HOURS_MIN_COMMITS } from './thresholds'

// ---------------------------------------------------------------------------
// helpers puros — linhas já filtradas entram, mapas somados saem
// ---------------------------------------------------------------------------
/** soma `valFn` agrupado por `keyFn` (default: commits) — base das agregações por mês/autor/repo */
export function groupBySum<T extends { commits: number }>(
  rows: readonly T[],
  keyFn: (r: T) => string,
  valFn: (r: T) => number = r => r.commits,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = keyFn(r)
    map.set(k, (map.get(k) ?? 0) + valFn(r))
  }
  return map
}

/** soma `valFn` agrupado por `outerFn`→`innerFn` (autor→semana, repo→autor, …) */
export function nestBySum<T extends { commits: number }>(
  rows: readonly T[],
  outerFn: (r: T) => string,
  innerFn: (r: T) => string,
  valFn: (r: T) => number = r => r.commits,
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const outer = outerFn(r)
    let inner = map.get(outer)
    if (!inner) {
      inner = new Map()
      map.set(outer, inner)
    }
    const k = innerFn(r)
    inner.set(k, (inner.get(k) ?? 0) + valFn(r))
  }
  return map
}

/** commits por repo (linhas mensais já filtradas ao período) — ordenado por volume */
export function commitsByRepoPeriod(rows: readonly MonthlyRow[]): { repo: string, commits: number }[] {
  return [...groupBySum(rows, r => r.repo).entries()]
    .map(([repo, commits]) => ({ repo, commits }))
    .sort((a, b) => b.commits - a.commits)
}

/** commits por autor (linhas mensais já filtradas ao período) — ordenado por volume */
export function commitsByAuthorPeriod(rows: readonly MonthlyRow[]): { author: string, commits: number }[] {
  return [...groupBySum(rows, r => r.author).entries()]
    .map(([author, commits]) => ({ author, commits }))
    .sort((a, b) => b.commits - a.commits)
}

/** commits por autor→semana (linhas semanais já filtradas) — ritmo e timeline */
export function commitsByAuthorWeek(rows: readonly WeeklyRow[]): Map<string, Map<string, number>> {
  return nestBySum(rows, r => r.author, r => r.week)
}

/** fix/total por repo (linhas de tipo já filtradas) — % de fix do RepoTable e do FixHotspots */
export function fixByRepo(rows: readonly MonthlyTypeRow[]): Map<string, { fix: number, total: number }> {
  const total = groupBySum(rows, r => r.repo)
  const fix = groupBySum(rows.filter(r => r.type === 'fix'), r => r.repo)
  return new Map([...total.entries()].map(([repo, t]) => [repo, { fix: fix.get(repo) ?? 0, total: t }]))
}

// ---------------------------------------------------------------------------
// agregações do período filtrado (computeds do store)
// ---------------------------------------------------------------------------
/** commits por repo no filtro atual (para o donut) */
export const commitsByRepo = computed(() => commitsByRepoPeriod(filteredMonthly.value))

/** commits por autor no filtro atual */
export const commitsByAuthor = computed(() => commitsByAuthorPeriod(filteredMonthly.value))

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

// ---------------------------------------------------------------------------
// ritmo (últimas 4 semanas vs média das 8 anteriores) — ignora o filtro de período
// ---------------------------------------------------------------------------
export interface PaceRow {
  author: string
  recent: number // commits nas últimas 4 semanas
  prevAvg: number // média semanal das 8 semanas anteriores
  ratio: number | null // (recent/4) / prevAvg
}

export const pace = computed<PaceRow[]>(() => {
  const rows = (stats.value?.weekly ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)))
  const byAuthor = commitsByAuthorWeek(rows)

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
  // mesma projeção filtrada do store (repo/autor/período)
  const rows = filteredWeekly.value
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
