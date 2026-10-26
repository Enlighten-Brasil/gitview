import type { DailyRow, PerAuthorScopeAxis, ReportCommitRow, Stats } from '../src/types'
import { describe, expect, it } from 'vitest'
import { validateReportCommitsData } from '../src/report-commits'

const GENERATED_AT = '2026-10-26T12:00:00.000Z'
const ROWS: ReportCommitRow[] = [
  { hash: 'a'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2026-10-16T01:00:00.000Z', day: '2026-10-15', message: 'feat: endpoint sintético', additions: 2, deletions: 1, scope: 'integration' },
  { hash: 'b'.repeat(40), repo: 'demo-api', author: 'Beto', date: '2026-10-16T01:00:00.000Z', day: '2026-10-15', message: 'fix: fixture', additions: 3, deletions: 0 },
  { hash: 'c'.repeat(40), repo: 'demo-web', author: 'Ana', date: '2026-10-16T01:00:00.000Z', day: '2026-10-15', message: 'docs: demo', additions: 5, deletions: 2, scope: 'branch' },
  { hash: 'd'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2020-01-01T12:00:00.000Z', day: '2020-01-01', message: 'chore: histórico antigo', additions: 7, deletions: 3 },
]

function emptyAxis(): PerAuthorScopeAxis {
  return { commits: 0, additions: 0, deletions: 0, repos: 0, activeDays: 0, lastCommit: '', streak: 0, longestStreak: 0 }
}

function fixture(rows: ReportCommitRow[] = ROWS) {
  const dailyMap = new Map<string, DailyRow>()
  for (const row of rows) {
    const scope = row.scope ?? 'prod'
    const key = JSON.stringify([row.day, row.repo, row.author, scope])
    const current = dailyMap.get(key) ?? { day: row.day, repo: row.repo, author: row.author, ...(scope === 'prod' ? {} : { scope }), commits: 0, additions: 0, deletions: 0, weekend: 0, night: 0 }
    current.commits++
    current.additions += row.additions
    current.deletions += row.deletions
    dailyMap.set(key, current)
  }

  const repos = [...new Set(rows.map(row => row.repo))].sort()
  const authors = [...new Set(rows.map(row => row.author))].sort()
  const perRepo: Stats['perRepo'] = repos.map((repo) => {
    const selected = rows.filter(row => row.repo === repo)
    return {
      repo,
      commits: selected.length,
      prodCommits: selected.filter(row => !row.scope).length,
      progressCommits: selected.filter(row => !!row.scope).length,
      additions: selected.reduce((sum, row) => sum + row.additions, 0),
      deletions: selected.reduce((sum, row) => sum + row.deletions, 0),
      authors: new Set(selected.map(row => row.author)).size,
      lastCommit: selected.map(row => row.date).sort().at(-1) ?? '',
    }
  })
  const perAuthor: Stats['perAuthor'] = authors.map((author) => {
    const selected = rows.filter(row => row.author === author)
    const prod = selected.filter(row => !row.scope)
    const progress = selected.filter(row => !!row.scope)
    const axis = (axisRows: ReportCommitRow[]): PerAuthorScopeAxis => ({
      ...emptyAxis(),
      commits: axisRows.length,
      additions: axisRows.reduce((sum, row) => sum + row.additions, 0),
      deletions: axisRows.reduce((sum, row) => sum + row.deletions, 0),
      repos: new Set(axisRows.map(row => row.repo)).size,
      activeDays: new Set(axisRows.map(row => row.day)).size,
      lastCommit: axisRows.map(row => row.date).sort().at(-1) ?? '',
    })
    return { author, ...axis(selected), byScope: { prod: axis(prod), progress: axis(progress) } }
  })
  const stats: Stats = {
    generatedAt: GENERATED_AT,
    repos,
    authors: authors.map(name => ({ name, emails: [], bot: false })),
    totals: {
      commits: rows.length,
      prodCommits: rows.filter(row => !row.scope).length,
      progressCommits: rows.filter(row => !!row.scope).length,
      additions: rows.reduce((sum, row) => sum + row.additions, 0),
      deletions: rows.reduce((sum, row) => sum + row.deletions, 0),
      activeDays: new Set(rows.map(row => row.day)).size,
      repos: repos.length,
      authors: authors.length,
    },
    perRepo,
    perAuthor,
    weekly: [],
    monthly: [],
    heatmap: [],
  }
  return {
    report: { generatedAt: GENERATED_AT, commits: structuredClone(rows) },
    daily: { generatedAt: GENERATED_AT, daily: [...dailyMap.values()] },
    stats,
  }
}

describe('validateReportCommitsData', () => {
  it('aceita o histórico completo reconciliado com daily e stats', () => {
    const { report, daily, stats } = fixture()
    expect(validateReportCommitsData(report, { daily, stats })).toEqual([])
  })

  it('aceita lista vazia coerente', () => {
    const { report, daily, stats } = fixture([])
    expect(validateReportCommitsData(report, { daily, stats })).toEqual([])
  })

  it('permite o mesmo hash em repos diferentes', () => {
    const { report } = fixture()
    report.commits[2].hash = report.commits[0].hash
    expect(validateReportCommitsData(report)).toEqual([])
  })

  it.each([
    ['envelope nulo', null, /objeto/],
    ['envelope em lista', [], /objeto/],
    ['lista ausente', { generatedAt: GENERATED_AT }, /commits/],
    ['lista com tipo errado', { generatedAt: GENERATED_AT, commits: {} }, /commits/],
    ['generatedAt inválido', { generatedAt: 'ontem', commits: [] }, /generatedAt/],
  ])('rejeita %s', (_name, value, expected) => {
    expect(validateReportCommitsData(value).join('\n')).toMatch(expected)
  })

  it.each([
    ['hash curto', (row: Record<string, unknown>) => { row.hash = 'abcdef0' }, /hash/],
    ['hash maiúsculo', (row: Record<string, unknown>) => { row.hash = 'A'.repeat(40) }, /hash/],
    ['repo vazio', (row: Record<string, unknown>) => { row.repo = '' }, /repo/],
    ['autor vazio', (row: Record<string, unknown>) => { row.author = ' ' }, /author/],
    ['mensagem não textual', (row: Record<string, unknown>) => { row.message = 1 }, /message/],
    ['data sem milissegundos', (row: Record<string, unknown>) => { row.date = '2026-10-16T01:00:00Z' }, /date/],
    ['data fora de UTC', (row: Record<string, unknown>) => { row.date = '2026-10-16T01:00:00.000-03:00' }, /date/],
    ['data inexistente', (row: Record<string, unknown>) => { row.date = '2026-02-30T01:00:00.000Z' }, /date/],
    ['dia malformado', (row: Record<string, unknown>) => { row.day = '16/10/2026' }, /day/],
    ['dia inexistente', (row: Record<string, unknown>) => { row.day = '2026-02-30' }, /day/],
    ['scope prod explícito', (row: Record<string, unknown>) => { row.scope = 'prod' }, /scope/],
    ['scope fora da union', (row: Record<string, unknown>) => { row.scope = 'other' }, /scope/],
    ['adições negativas', (row: Record<string, unknown>) => { row.additions = -1 }, /additions/],
    ['deleções fracionárias', (row: Record<string, unknown>) => { row.deletions = 1.5 }, /deletions/],
  ])('rejeita %s', (_name, mutate, expected) => {
    const { report } = fixture()
    mutate(report.commits[0] as unknown as Record<string, unknown>)
    expect(validateReportCommitsData(report).join('\n')).toMatch(expected)
  })

  it('rejeita linha que não é objeto', () => {
    const { report } = fixture()
    ;(report.commits as unknown[])[0] = null
    expect(validateReportCommitsData(report).join('\n')).toMatch(/commits\[0\].*objeto/)
  })

  it('rejeita duplicata de hash no mesmo repo', () => {
    const { report } = fixture()
    report.commits[1].hash = report.commits[0].hash
    expect(validateReportCommitsData(report).join('\n')).toMatch(/duplicado/i)
  })

  it('rejeita ordem por timestamp, repo e hash', () => {
    const timestamp = fixture().report
    ;[timestamp.commits[0], timestamp.commits[3]] = [timestamp.commits[3], timestamp.commits[0]]
    expect(validateReportCommitsData(timestamp).join('\n')).toMatch(/ordem/i)

    const repo = fixture().report
    repo.commits[2].repo = 'demo-aaa'
    expect(validateReportCommitsData(repo).join('\n')).toMatch(/ordem/i)

    const hash = fixture().report
    ;[hash.commits[0].hash, hash.commits[1].hash] = [hash.commits[1].hash, hash.commits[0].hash]
    expect(validateReportCommitsData(hash).join('\n')).toMatch(/ordem/i)
  })
})

describe('reconciliação do report-commits', () => {
  it('exige o mesmo generatedAt do stats', () => {
    const { report, daily, stats } = fixture()
    stats.generatedAt = '2026-10-26T12:00:00.001Z'
    expect(validateReportCommitsData(report, { daily, stats }).join('\n')).toMatch(/generatedAt.*stats/)
  })

  it('rejeita grupos ausentes nos dois sentidos', () => {
    const missingDaily = fixture()
    missingDaily.daily.daily.splice(0, 1)
    expect(validateReportCommitsData(missingDaily.report, missingDaily).join('\n')).toMatch(/ausente.*daily/i)

    const orphanDaily = fixture()
    const extra = { ...orphanDaily.daily.daily[0], author: 'Sem commit' }
    orphanDaily.daily.daily.push(extra)
    expect(validateReportCommitsData(orphanDaily.report, orphanDaily).join('\n')).toMatch(/órfão|ausente.*report/i)
  })

  it('detecta remoção e acréscimo de linhas', () => {
    const removed = fixture()
    removed.report.commits.pop()
    expect(validateReportCommitsData(removed.report, removed)).not.toEqual([])

    const added = fixture()
    added.report.commits.splice(3, 0, { ...added.report.commits[2], hash: 'e'.repeat(40) })
    expect(validateReportCommitsData(added.report, added)).not.toEqual([])
  })

  it('detecta troca de autores mesmo com totais globais compensados', () => {
    const rows = [0, 1].map((index) => {
      const row = structuredClone(ROWS[index])
      row.author = index === 0 ? 'Ana' : 'Beto'
      delete row.scope
      return row
    })
    const changed = fixture(rows)
    ;[changed.report.commits[0].author, changed.report.commits[1].author] = [changed.report.commits[1].author, changed.report.commits[0].author]
    expect(validateReportCommitsData(changed.report, changed).join('\n')).toMatch(/grupo.*daily|daily.*grupo/i)
  })

  it('detecta troca de dias mesmo com totais globais compensados', () => {
    const rows = [0, 3].map((index) => {
      const row = structuredClone(ROWS[index])
      delete row.scope
      return row
    })
    const changed = fixture(rows)
    ;[changed.report.commits[0].day, changed.report.commits[1].day] = [changed.report.commits[1].day, changed.report.commits[0].day]
    expect(validateReportCommitsData(changed.report, changed).join('\n')).toMatch(/grupo.*daily|daily.*grupo/i)
  })

  it.each(['commits', 'prodCommits', 'progressCommits', 'additions', 'deletions'] as const)('reconcilia totals.%s', (field) => {
    const { report, daily, stats } = fixture()
    stats.totals[field]++
    expect(validateReportCommitsData(report, { daily, stats }).join('\n').match(`totals.*${field}|${field}.*totals`)).not.toBeNull()
  })

  it('reconcilia métricas e escopos por autor', () => {
    const totals = fixture()
    totals.stats.perAuthor[0].additions++
    expect(validateReportCommitsData(totals.report, totals).join('\n')).toMatch(/perAuthor/)

    const axes = fixture()
    const ana = axes.stats.perAuthor.find(row => row.author === 'Ana')!
    ana.byScope!.progress.commits++
    expect(validateReportCommitsData(axes.report, axes).join('\n')).toMatch(/byScope|progress/)
  })

  it('reconcilia totais e escopos por repo', () => {
    const { report, daily, stats } = fixture()
    stats.perRepo[0].prodCommits++
    expect(validateReportCommitsData(report, { daily, stats }).join('\n')).toMatch(/perRepo/)
  })

  it('rejeita autores e repos órfãos nos mapas de stats', () => {
    const author = fixture()
    author.stats.perAuthor.push({ author: 'Órfão', ...emptyAxis(), byScope: { prod: emptyAxis(), progress: emptyAxis() } })
    expect(validateReportCommitsData(author.report, author).join('\n')).toMatch(/órfão/i)

    const repo = fixture()
    repo.stats.perRepo.push({ repo: 'demo-orphan', commits: 0, prodCommits: 0, progressCommits: 0, additions: 0, deletions: 0, authors: 0, lastCommit: '' })
    expect(validateReportCommitsData(repo.report, repo).join('\n')).toMatch(/órfão/i)
  })

  it('rejeita repo fora de stats.repos', () => {
    const { report, daily, stats } = fixture()
    stats.repos = stats.repos.filter(repo => repo !== 'demo-web')
    expect(validateReportCommitsData(report, { daily, stats }).join('\n')).toMatch(/stats\.repos/)
  })

  it('falha fechado com fontes de reconciliação malformadas', () => {
    const { report } = fixture()
    expect(validateReportCommitsData(report, { daily: null, stats: null }).join('\n')).toMatch(/daily\.json/)
    expect(validateReportCommitsData(report, { stats: null }).join('\n')).toMatch(/stats\.json/)
  })
})
