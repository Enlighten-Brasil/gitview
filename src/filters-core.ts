/**
 * Núcleo dos filtros da sidebar: estado global + predicados de seleção e
 * período. Antes isso vivia duplicado em data.ts (cutoffDate/selectedRepo/
 * selectedAuthor/inRange) e em github.ts (cutoff/repoOk/authorOk/inPeriod) —
 * uma implementação só, com a granularidade da janela no nome (issue #39).
 *
 * Escrita no estado: só pelas ações nomeadas de data.ts (setRange/toggleRepo/
 * lockAuthors/resetSelection...) e pelo urlState (sincronização com a URL).
 */
import { reactive } from 'vue'
import { isoWeekMonday } from './date'

/**
 * Escopos de trabalho das métricas (issue #128) — união fechada no padrão
 * PROGRESS_SCOPES (types.ts), casando com a codificação omit-prod dos dados
 * (issues #118/#119): linha sem `scope` = 'prod'; 'progress' agrupa
 * 'integration' + 'branch'; 'all' desliga o filtro. O campo de estado se
 * chama workScope para não colidir com FilterScope (escopo de ROTA,
 * router/meta.ts) — o param público de URL continua ?scope=.
 */
export const WORK_SCOPES = ['all', 'prod', 'progress'] as const

export type WorkScope = typeof WORK_SCOPES[number]

/** valida valor de ?scope=/localStorage — fora da união fechada → false */
export function isWorkScope(value: unknown): value is WorkScope {
  return typeof value === 'string' && (WORK_SCOPES as readonly string[]).includes(value)
}

export interface FiltersState {
  repos: string[] // vazio = todos
  authors: string[] // vazio = todos
  rangeMonths: number | null // null = todo o histórico
  /** range customizado (YYYY-MM-DD) — quando preenchido, prevalece sobre rangeMonths */
  dateFrom: string | null
  dateTo: string | null
  showBots: boolean
  /**
   * escopo de trabalho (issue #128): 'all' = todas as linhas; 'prod' = só as
   * sem `scope` (ref de produção); 'progress' = só 'integration'/'branch'
   */
  workScope: WorkScope
}

export const filters = reactive<FiltersState>({
  repos: [],
  authors: [],
  rangeMonths: 12,
  dateFrom: null,
  dateTo: null,
  showBots: false,
  workScope: 'all',
})

/** range customizado ativo? */
export function isCustomRange(): boolean {
  return !!(filters.dateFrom || filters.dateTo)
}

/** início da janela filtrada (null = sem corte, histórico completo) */
export function cutoff(): Date | null {
  if (filters.dateFrom)
    return new Date(`${filters.dateFrom}T00:00:00`)
  if (filters.rangeMonths == null)
    return null
  const d = new Date()
  d.setMonth(d.getMonth() - filters.rangeMonths)
  return d
}

/** repo dentro da seleção? (vazio = todos) */
export function repoSelected(repo: string): boolean {
  return filters.repos.length === 0 || filters.repos.includes(repo)
}

/**
 * autor dentro da seleção? `name` é o nome canônico (o chamador resolve
 * login→nome quando for o caso); `bot` já vem resolvido na fonte do chamador
 * (stats para commits, users do github.json para PRs).
 */
export function authorSelected(name: string, bot = false): boolean {
  if (!filters.showBots && bot)
    return false
  return filters.authors.length === 0 || filters.authors.includes(name)
}

/**
 * month key (YYYY-MM) de uma chave de período: para "YYYY-Www", o mês da
 * segunda-feira da semana (o dia que ancora a semana); para "YYYY-MM", a
 * própria chave.
 */
function toMonthKey(periodKey: string): string {
  const monday = isoWeekMonday(periodKey)
  if (!monday)
    return periodKey.slice(0, 7)
  return `${monday.getUTCFullYear()}-${String(monday.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * chave de período (YYYY-MM | YYYY-Www) dentro da janela filtrada —
 * corte por MÊS (agregações mensais/semanais). Semana pertence ao mês da
 * sua segunda-feira (via toMonthKey), para o corte mensal valer também
 * para as vistas semanais.
 */
export function inPeriodMonth(periodKey: string): boolean {
  const key = toMonthKey(periodKey)
  // range customizado: compara mês a mês com from/to
  if (isCustomRange()) {
    if (filters.dateFrom && key < filters.dateFrom.slice(0, 7))
      return false
    if (filters.dateTo && key > filters.dateTo.slice(0, 7))
      return false
    return true
  }
  const cut = cutoff()
  if (!cut)
    return true
  // key é o mês do período (semana → mês da segunda) — compara pelo começo do período
  return key >= `${cut.getFullYear()}-${String(cut.getMonth() + 1).padStart(2, '0')}`
}

/**
 * timestamp ISO dentro da janela filtrada — corte por DIA (datas pontuais:
 * merge de PR, review). null sempre fica fora.
 */
export function inPeriodDay(iso: string | null): boolean {
  if (!iso)
    return false
  const d = new Date(iso)
  const cut = cutoff()
  if (cut && d < cut)
    return false
  if (filters.dateTo && d > new Date(`${filters.dateTo}T23:59:59`))
    return false
  return true
}
