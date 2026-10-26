export type ReportSubjectId = 'org' | 'team' | 'dev'
export type ReportPresetId = 'week-closed' | 'week-current' | '7d' | 'last-month' | 'month-current' | '30d' | 'custom'

export interface ReportQueryState {
  subject: ReportSubjectId
  team: string
  dev: string
  preset: ReportPresetId
  from: string | null
  to: string | null
  people: boolean
  commits: boolean
}

export const DEFAULT_REPORT_PRESET: ReportPresetId = '7d'

const SUBJECTS: readonly ReportSubjectId[] = ['org', 'team', 'dev']
const PRESETS: readonly ReportPresetId[] = ['week-closed', 'week-current', '7d', 'last-month', 'month-current', '30d', 'custom']
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

function isDay(value: unknown): value is string {
  if (typeof value !== 'string')
    return false
  const match = DAY_RE.exec(value)
  if (!match)
    return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Query da rota → estado canônico. Valores repetidos/arrays nunca ligam opt-ins. */
export function sanitizeReportQuery(query: Record<string, unknown>): ReportQueryState {
  const subject = SUBJECTS.includes(query.subject as ReportSubjectId) ? query.subject as ReportSubjectId : 'org'
  let preset = PRESETS.includes(query.preset as ReportPresetId) ? query.preset as ReportPresetId : DEFAULT_REPORT_PRESET
  const from = isDay(query.from) ? query.from : null
  const to = isDay(query.to) ? query.to : null
  if (preset === 'custom' && (!from || !to || from > to))
    preset = DEFAULT_REPORT_PRESET
  return {
    subject,
    team: typeof query.team === 'string' ? query.team : '',
    dev: typeof query.dev === 'string' ? query.dev : '',
    preset,
    from,
    to,
    people: query.people === '1',
    commits: query.commits === '1',
  }
}

/** Estado canônico → query reproduzível, sem defaults nem campos irrelevantes. */
export function reportQueryOf(state: ReportQueryState): Record<string, string> {
  const query: Record<string, string> = {}
  if (state.subject !== 'org')
    query.subject = state.subject
  if (state.subject === 'team' && state.team)
    query.team = state.team
  if (state.subject === 'dev' && state.dev)
    query.dev = state.dev
  if (state.preset !== DEFAULT_REPORT_PRESET)
    query.preset = state.preset
  if (state.preset === 'custom' && state.from && state.to) {
    query.from = state.from
    query.to = state.to
  }
  if (state.people)
    query.people = '1'
  if (state.commits)
    query.commits = '1'
  return query
}

/** Somente preferências neutras podem ser lembradas entre visitas. */
export function reportQueryForStorage(state: ReportQueryState): Record<string, string> {
  const query = reportQueryOf(state)
  delete query.people
  delete query.commits
  return query
}
