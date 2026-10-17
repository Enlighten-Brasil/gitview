/**
 * Fachada do store de dados (issue #41) — só orquestração/reexports. A
 * implementação ficou dividida por responsabilidade:
 *
 * - `./filters-core` — estado dos filtros + predicados de seleção/período (issue #39)
 * - `./filters` — loaders dos JSONs, ações nomeadas e projeções já filtradas
 * - `./date` — aritmética de semana ISO (chaves "YYYY-Www")
 * - `./aggregations` — helpers de soma por mês/autor/repo + métricas de negócio
 *
 * Os consumidores continuam importando daqui (`@/data` / `../data`) — ver cada
 * módulo para a implementação.
 */

// agregações: helpers puros (linhas já filtradas entram) + métricas do período
export {
  burnout,
  commitsByAuthor,
  commitsByAuthorPeriod,
  commitsByAuthorWeek,
  commitsByRepo,
  commitsByRepoPeriod,
  filteredTotals,
  fixByRepo,
  groupBySum,
  nestBySum,
  offHoursPeriod,
  pace,
  previousTotals,
} from './aggregations'

export type { BurnoutRow, OffHoursRow, PaceRow } from './aggregations'

// aritmética de semana ISO — usada pelo resumo semanal e pelas janelas fixas
export { isoWeekKey, isoWeekKeyBefore, isoWeekMonday, lastNWeekKeys } from './date'

// store: loaders, ações nomeadas, projeções filtradas e label do período
export {
  filteredCommitCount,
  filteredHeatmap,
  filteredMonthly,
  filteredTypes,
  filteredWeekly,
  isBot,
  loadCommits,
  loadError,
  loadStats,
  lockAuthors,
  rangeLabel,
  recentCommits,
  resetSelection,
  setAuthors,
  setCustomRange,
  setRange,
  setRepos,
  setShowBots,
  stats,
  toggleAuthor,
  toggleCustomRange,
  toggleRepo,
  toggleTeam,
} from './filters'
// núcleo dos filtros (estado + predicados) — issue #39
export {
  authorSelected,
  cutoff,
  filters,
  inPeriodDay,
  inPeriodMonth,
  isCustomRange,
  repoSelected,
} from './filters-core'
