import type { ReportCommitRow } from './types'
import { isProgressScope } from './types'

const HASH40_RE = /^[0-9a-f]{40}$/
const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ReportCommitSources {
  daily?: unknown
  stats?: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isUtcIsoMs(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_MS_RE.test(value))
    return false
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString() === value
}

function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !DAY_RE.test(value))
    return false
  const time = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

export function compareReportCommitRows(a: ReportCommitRow, b: ReportCommitRow): number {
  return Date.parse(b.date) - Date.parse(a.date)
    || (a.repo === b.repo ? 0 : a.repo < b.repo ? -1 : 1)
    || (a.hash === b.hash ? 0 : a.hash < b.hash ? -1 : 1)
}

interface Metrics {
  commits: number
  additions: number
  deletions: number
}

interface RepoMetrics extends Metrics {
  prodCommits: number
  progressCommits: number
}

interface AuthorMetrics extends Metrics {
  prod: Metrics
  progress: Metrics
}

type MetricField = keyof RepoMetrics

function metricValue(value: Metrics, field: keyof Metrics): number
function metricValue(value: RepoMetrics, field: keyof RepoMetrics): number
function metricValue(value: Record<string, unknown>, field: MetricField): unknown
function metricValue(value: Metrics | RepoMetrics | Record<string, unknown>, field: MetricField): unknown {
  const record = value as Record<string, unknown>
  switch (field) {
    case 'commits': return record.commits
    case 'additions': return record.additions
    case 'deletions': return record.deletions
    case 'prodCommits': return record.prodCommits
    case 'progressCommits': return record.progressCommits
  }
}

function newMetrics(): Metrics {
  return { commits: 0, additions: 0, deletions: 0 }
}

function addMetrics(target: Metrics, row: ReportCommitRow, commits = 1): void {
  target.commits += commits
  target.additions += row.additions
  target.deletions += row.deletions
}

function groupKey(day: string, repo: string, author: string, scope?: string): string {
  return JSON.stringify([day, repo, author, scope ?? 'prod'])
}

function compareField(actual: unknown, expected: number, label: string, errors: string[]): void {
  if (actual !== expected)
    errors.push(`report-commits.json: ${label} diverge do log (esperado ${expected}, veio ${JSON.stringify(actual)})`)
}

function reconcileDaily(rows: ReportCommitRow[], source: unknown, errors: string[]): void {
  if (!isRecord(source) || !Array.isArray(source.daily)) {
    errors.push('daily.json.daily: esperado lista para reconciliação')
    return
  }

  const expected = new Map<string, Metrics>()
  for (const row of rows) {
    const key = groupKey(row.day, row.repo, row.author, row.scope)
    const current = expected.get(key) ?? newMetrics()
    addMetrics(current, row)
    expected.set(key, current)
  }

  const actual = new Map<string, Metrics>()
  let index = 0
  for (const row of source.daily as unknown[]) {
    const i = index++
    const valid = isRecord(row)
      && isDay(row.day)
      && typeof row.repo === 'string' && !!row.repo.trim()
      && typeof row.author === 'string' && !!row.author.trim()
      && (!('scope' in row) || isProgressScope(row.scope))
      && isCount(row.commits) && isCount(row.additions) && isCount(row.deletions)
    if (!valid) {
      errors.push(`daily.json.daily[${i}]: shape inválido para reconciliação`)
      continue
    }
    const key = groupKey(row.day as string, row.repo as string, row.author as string, row.scope as string | undefined)
    const current = actual.get(key) ?? newMetrics()
    current.commits += row.commits as number
    current.additions += row.additions as number
    current.deletions += row.deletions as number
    actual.set(key, current)
  }

  const keys = [...new Set([...expected.keys(), ...actual.keys()])].sort()
  for (const key of keys) {
    const reportMetrics = expected.get(key)
    const dailyMetrics = actual.get(key)
    if (!dailyMetrics) {
      errors.push(`report-commits.json: grupo ${key} ausente no daily.json`)
      continue
    }
    if (!reportMetrics) {
      errors.push(`daily.json: grupo órfão ${key}, ausente no report-commits.json`)
      continue
    }
    for (const field of ['commits', 'additions', 'deletions'] as const) {
      const expectedValue = metricValue(reportMetrics, field)
      const actualValue = metricValue(dailyMetrics, field)
      if (expectedValue !== actualValue)
        errors.push(`report-commits.json: divergência no grupo ${key} com daily.json (${field}: ${expectedValue} != ${actualValue})`)
    }
  }
}

function indexBy(value: unknown, field: 'author' | 'repo', where: string, errors: string[]): Map<string, Record<string, unknown>> | null {
  if (!Array.isArray(value)) {
    errors.push(`${where}: esperado lista para reconciliação`)
    return null
  }
  const map = new Map<string, Record<string, unknown>>()
  let index = 0
  for (const row of value as unknown[]) {
    const i = index++
    const key = isRecord(row) ? (field === 'author' ? row.author : row.repo) : undefined
    if (!isRecord(row) || typeof key !== 'string' || !key.trim()) {
      errors.push(`${where}[${i}]: esperado objeto com ${field} não vazio`)
      continue
    }
    if (map.has(key))
      errors.push(`${where}: ${field} duplicado (${key})`)
    map.set(key, row)
  }
  return map
}

function reconcileStats(rows: ReportCommitRow[], generatedAt: unknown, source: unknown, errors: string[]): void {
  if (!isRecord(source)) {
    errors.push('stats.json: esperado objeto para reconciliação')
    return
  }
  if (source.generatedAt !== generatedAt)
    errors.push(`report-commits.json.generatedAt (${JSON.stringify(generatedAt)}) != stats.json.generatedAt (${JSON.stringify(source.generatedAt)})`)

  const totals = {
    commits: rows.length,
    prodCommits: rows.filter(row => !row.scope).length,
    progressCommits: rows.filter(row => !!row.scope).length,
    additions: rows.reduce((sum, row) => sum + row.additions, 0),
    deletions: rows.reduce((sum, row) => sum + row.deletions, 0),
  }
  if (!isRecord(source.totals)) {
    errors.push('stats.json.totals: esperado objeto para reconciliação')
  }
  else {
    for (const field of Object.keys(totals) as (keyof typeof totals)[])
      compareField(metricValue(source.totals, field), metricValue(totals, field), `stats.json.totals.${field}`, errors)
  }

  if (!Array.isArray(source.repos) || !source.repos.every(repo => typeof repo === 'string')) {
    errors.push('stats.json.repos: esperado lista de strings para reconciliação')
  }
  else {
    const knownRepos = new Set(source.repos)
    for (const repo of new Set(rows.map(row => row.repo))) {
      if (!knownRepos.has(repo))
        errors.push(`report-commits.json: repo ${repo} ausente em stats.repos`)
    }
  }

  const byAuthor = new Map<string, AuthorMetrics>()
  const byRepo = new Map<string, RepoMetrics>()
  for (const row of rows) {
    const author = byAuthor.get(row.author) ?? { ...newMetrics(), prod: newMetrics(), progress: newMetrics() }
    addMetrics(author, row)
    addMetrics(row.scope ? author.progress : author.prod, row)
    byAuthor.set(row.author, author)

    const repo = byRepo.get(row.repo) ?? { ...newMetrics(), prodCommits: 0, progressCommits: 0 }
    addMetrics(repo, row)
    if (row.scope)
      repo.progressCommits++
    else
      repo.prodCommits++
    byRepo.set(row.repo, repo)
  }

  const actualAuthors = indexBy(source.perAuthor, 'author', 'stats.json.perAuthor', errors)
  if (actualAuthors) {
    const authors = [...new Set([...byAuthor.keys(), ...actualAuthors.keys()])].sort()
    for (const name of authors) {
      const expected = byAuthor.get(name)
      const actual = actualAuthors.get(name)
      if (!actual) {
        errors.push(`stats.json.perAuthor: autor órfão ${name}, ausente no mapa`)
        continue
      }
      if (!expected) {
        errors.push(`report-commits.json: autor órfão ${name} em stats.json.perAuthor`)
        continue
      }
      for (const field of ['commits', 'additions', 'deletions'] as const)
        compareField(metricValue(actual, field), metricValue(expected, field), `stats.json.perAuthor[${name}].${field}`, errors)
      if ('byScope' in actual) {
        if (!isRecord(actual.byScope)) {
          errors.push(`stats.json.perAuthor[${name}].byScope: esperado objeto`)
          continue
        }
        for (const axis of ['prod', 'progress'] as const) {
          const actualAxis = axis === 'prod' ? actual.byScope.prod : actual.byScope.progress
          const expectedAxis = axis === 'prod' ? expected.prod : expected.progress
          if (!isRecord(actualAxis)) {
            errors.push(`stats.json.perAuthor[${name}].byScope.${axis}: esperado objeto`)
            continue
          }
          for (const field of ['commits', 'additions', 'deletions'] as const)
            compareField(metricValue(actualAxis, field), metricValue(expectedAxis, field), `stats.json.perAuthor[${name}].byScope.${axis}.${field}`, errors)
        }
      }
    }
  }

  const actualRepos = indexBy(source.perRepo, 'repo', 'stats.json.perRepo', errors)
  if (actualRepos) {
    const repos = [...new Set([...byRepo.keys(), ...actualRepos.keys()])].sort()
    for (const name of repos) {
      const expected = byRepo.get(name)
      const actual = actualRepos.get(name)
      if (!actual) {
        errors.push(`stats.json.perRepo: repo órfão ${name}, ausente no mapa`)
        continue
      }
      if (!expected) {
        errors.push(`report-commits.json: repo órfão ${name} em stats.json.perRepo`)
        continue
      }
      for (const field of ['commits', 'prodCommits', 'progressCommits', 'additions', 'deletions'] as const)
        compareField(metricValue(actual, field), metricValue(expected, field), `stats.json.perRepo[${name}].${field}`, errors)
    }
  }
}

/** Núcleo puro: valida e reconcilia o artefato sem fetch ou APIs de browser. */
export function validateReportCommitsData(data: unknown, sources: ReportCommitSources = {}): string[] {
  const errors: string[] = []
  if (!isRecord(data))
    return ['report-commits.json: esperado objeto no topo']

  if (!isUtcIsoMs(data.generatedAt))
    errors.push('report-commits.json.generatedAt: esperado UTC ISO com milissegundos')
  if (!Array.isArray(data.commits)) {
    errors.push('report-commits.json.commits: esperado lista')
    return errors
  }

  const rows: ReportCommitRow[] = []
  const seen = new Set<string>()
  let index = 0
  for (const value of data.commits as unknown[]) {
    const i = index++
    const where = `report-commits.json.commits[${i}]`
    if (!isRecord(value)) {
      errors.push(`${where}: esperado objeto`)
      continue
    }

    let valid = true
    const invalidate = (condition: boolean, message: string) => {
      if (!condition) {
        errors.push(`${where}.${message}`)
        valid = false
      }
    }
    invalidate(typeof value.hash === 'string' && HASH40_RE.test(value.hash), `hash: esperado 40 hex minúsculos, veio ${JSON.stringify(value.hash)}`)
    invalidate(typeof value.repo === 'string' && !!value.repo.trim(), 'repo: esperado string não vazia')
    invalidate(typeof value.author === 'string' && !!value.author.trim(), 'author: esperado string não vazia')
    invalidate(isUtcIsoMs(value.date), `date: esperado UTC ISO com milissegundos, veio ${JSON.stringify(value.date)}`)
    invalidate(isDay(value.day), `day: esperado dia real YYYY-MM-DD, veio ${JSON.stringify(value.day)}`)
    invalidate(typeof value.message === 'string', 'message: esperado string')
    invalidate(isCount(value.additions), `additions: esperado inteiro >= 0, veio ${JSON.stringify(value.additions)}`)
    invalidate(isCount(value.deletions), `deletions: esperado inteiro >= 0, veio ${JSON.stringify(value.deletions)}`)
    invalidate(!('scope' in value) || isProgressScope(value.scope), `scope: union fechada integration|branch; prod deve ser omitido, veio ${JSON.stringify(value.scope)}`)

    if (typeof value.repo === 'string' && typeof value.hash === 'string') {
      const key = JSON.stringify([value.repo, value.hash])
      if (seen.has(key)) {
        errors.push(`${where}: hash duplicado no repo (${value.repo}, ${value.hash})`)
        valid = false
      }
      seen.add(key)
    }
    if (valid)
      rows.push(value as unknown as ReportCommitRow)
  }

  if (rows.length === data.commits.length) {
    let previous: ReportCommitRow | undefined
    let i = 0
    for (const row of rows) {
      if (previous && compareReportCommitRows(previous, row) > 0)
        errors.push(`report-commits.json.commits[${i}]: fora de ordem (timestamp desc, repo asc, hash asc)`)
      previous = row
      i++
    }
  }

  if (errors.length)
    return errors
  if (sources.daily !== undefined)
    reconcileDaily(rows, sources.daily, errors)
  if (sources.stats !== undefined)
    reconcileStats(rows, data.generatedAt, sources.stats, errors)
  return errors
}
