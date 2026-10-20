/**
 * Resumo semanal exportável — wrapper do motor de relatórios (issue #176):
 * preset "semana ISO fechada × organização", o artefato de reunião da issue
 * #129 (UI: `components/WeeklySummary.vue`). Assuntos/janelas/delta/fallback
 * moram em ./report; direção única de import — report.ts NUNCA importa daqui.
 */
import { isoWeekKey, stats } from './data'
import { buildReport, presetWindow } from './report'

export interface WeeklySummary {
  /** segunda da semana coberta */
  from: Date
  /** domingo 23:59:59 da semana coberta */
  to: Date
  weekKey: string
  markdown: string
}

export function buildWeeklySummary(): WeeklySummary | null {
  if (!stats.value)
    return null
  const { from, to } = presetWindow('last-week')
  const report = buildReport({ kind: 'org' }, from, to)
  return report && { from, to, weekKey: isoWeekKey(from), markdown: report.markdown }
}
