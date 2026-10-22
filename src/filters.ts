/**
 * Store dos filtros (issue #41): loaders dos JSONs, ações nomeadas de escrita
 * do estado e as projeções já filtradas (weekly/monthly/heatmap/types) que os
 * componentes consomem. O estado e os predicados vivem em ./filters-core
 * (issue #39); as agregações de negócio ficam em ./aggregations e a aritmética
 * de semana ISO em ./date. O data.ts reexporta tudo — consumidores continuam
 * importando de lá.
 */
import type { WorkScope } from './filters-core'
import type { CommitRow, ProgressScope, Stats } from './types'
import { computed } from 'vue'
import { authorSelected, filters, inPeriodMonth, isCustomRange, repoSelected } from './filters-core'
import { fmtDate } from './format'
import { getComposer } from './i18n'
import { defineLoader } from './loader'
import { isProgressScope } from './types'

// loader do stats.json — a mensagem do HTTP não-OK carrega a instrução de coleta
const statsLoader = defineLoader<Stats>('stats.json', {
  httpError: status => `HTTP ${status} — rode "pnpm collect" primeiro`,
})
export const stats = statsLoader.data
// erro de REDE do último load (≠ 404/HTML = sem arquivo) — o retry do toast observa
export const statsNetworkError = statsLoader.networkError
// erro de SERVIDOR (HTTP >= 500) do último load (≠ rede/sem-arquivo) — idem
export const statsServerError = statsLoader.serverError
export const loadStats = statsLoader.load

/** commits recentes (últimos 100/autor) — carregado sob demanda pela página do dev */
const commitsLoader = defineLoader<CommitRow[]>('commits.json', {
  pick: json => (json as { commits: CommitRow[] }).commits,
  // em falha esvazia a lista; o painel do dev distingue erro de vazio real
  // pela ref de erro exportada (commitsError, issue #194)
  onErrorValue: [],
})
export const recentCommits = commitsLoader.data
export const commitsError = commitsLoader.error
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

/** escopo de trabalho das métricas (issue #128): 'all' | 'prod' | 'progress' */
export function setWorkScope(scope: WorkScope): void {
  filters.workScope = scope
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

/**
 * linha pertence ao escopo de trabalho atual? (issue #128) — predicado único
 * das 4 projeções abaixo e dos iteradores diretos de ./aggregations
 * (previousTotals/pace/burnout). Codificação omit-prod dos dados: `scope`
 * ausente = linha de produção; 'progress' = 'integration' + 'branch'.
 */
export function scopeMatches(row: { scope?: ProgressScope }): boolean {
  if (filters.workScope === 'all')
    return true
  if (filters.workScope === 'prod')
    return !row.scope
  return isProgressScope(row.scope)
}

// ---------------------------------------------------------------------------
// projeções já filtradas (seleção de repo/autor + período + escopo) — os
// componentes consomem direto em vez de refiltrar o stats por conta própria
// ---------------------------------------------------------------------------
export const filteredWeekly = computed(() =>
  (stats.value?.weekly ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && inPeriodMonth(r.week) && scopeMatches(r)),
)

export const filteredMonthly = computed(() =>
  (stats.value?.monthly ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && inPeriodMonth(r.month) && scopeMatches(r)),
)

export const filteredHeatmap = computed(() =>
  (stats.value?.heatmap ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && inPeriodMonth(r.month) && scopeMatches(r)),
)

/** tipos de commit (feat/fix/...) no filtro atual — aba Repositórios */
export const filteredTypes = computed(() =>
  (stats.value?.monthlyTypes ?? []).filter(r =>
    repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && inPeriodMonth(r.month) && scopeMatches(r),
  ),
)

/** commits no período filtrado (para cards) */
export const filteredCommitCount = computed(() =>
  filteredMonthly.value.reduce((acc, r) => acc + r.commits, 0),
)

/** label do período selecionado (navbar + cards) — traduzido no módulo: o composer lê o locale reativamente */
export const rangeLabel = computed(() => {
  const { t } = getComposer()
  if (isCustomRange()) {
    const from = filters.dateFrom ? fmtDate(`${filters.dateFrom}T00:00:00`) : t('filters.range.customStart')
    const to = filters.dateTo ? fmtDate(`${filters.dateTo}T00:00:00`) : t('filters.range.customEnd')
    return `${from} → ${to}`
  }
  if (filters.rangeMonths == null)
    return t('filters.range.all')
  return filters.rangeMonths === 1 ? t('filters.range.lastMonth') : t('filters.range.lastN', { n: filters.rangeMonths })
})
