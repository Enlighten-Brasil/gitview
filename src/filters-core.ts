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

export interface FiltersState {
  repos: string[] // vazio = todos
  authors: string[] // vazio = todos
  rangeMonths: number | null // null = todo o histórico
  /** range customizado (YYYY-MM-DD) — quando preenchido, prevalece sobre rangeMonths */
  dateFrom: string | null
  dateTo: string | null
  showBots: boolean
}

export const filters = reactive<FiltersState>({
  repos: [],
  authors: [],
  rangeMonths: 12,
  dateFrom: null,
  dateTo: null,
  showBots: false,
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
 * chave de período (YYYY-MM | YYYY-Www) dentro da janela filtrada —
 * corte por MÊS (agregações mensais/semanais).
 */
export function inPeriodMonth(periodKey: string): boolean {
  const key = periodKey.slice(0, 7)
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
  // periodKey é "YYYY-Www" ou "YYYY-MM" — compara pelo começo do período
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
