import type { ReportSubject } from '../src/report'
import type { ReportCommitRow, ReportCommitsData, Stats, TeamData } from '../src/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daily, dailyError, dailyGeneratedAt, dailyLoading } from '../src/daily'
import { stats } from '../src/data'
import { github } from '../src/github'
import { mdText, renderMarkdown } from '../src/markdown'
import { releases } from '../src/releases'
import { buildReport, customWindow, presetWindow } from '../src/report'
import { compareReportCommitRows } from '../src/report-commits'
import { reportCommits, reportCommitsActive, reportCommitsError, reportCommitsLoading } from '../src/report-commits-loader'
import { buildWeeklySummary } from '../src/summary'
import { team } from '../src/team'

const NOW = new Date(2026, 9, 15, 12)
const GENERATED_AT = '2026-10-15T12:00:00.000Z'
const BASE_ROWS: ReportCommitRow[] = [
  { hash: 'a'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2026-10-10T12:00:00.000Z', day: '2026-10-10', message: 'feat: seguro', additions: 2, deletions: 1 },
  { hash: 'b'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2026-10-10T12:00:00.000Z', day: '2026-10-10', message: 'Merge relato preservado', additions: 3, deletions: 0, scope: 'integration' },
  { hash: 'c'.repeat(40), repo: 'demo-web', author: 'Ana', date: '2026-10-10T12:00:00.000Z', day: '2026-10-10', message: 'fix: branch', additions: 4, deletions: 2, scope: 'branch' },
  { hash: 'd'.repeat(40), repo: 'demo-api', author: 'Beto', date: '2026-10-10T12:00:00.000Z', day: '2026-10-10', message: 'feat: Beto', additions: 5, deletions: 1 },
  { hash: 'e'.repeat(40), repo: 'demo-api', author: 'CI Bot', date: '2026-10-10T12:00:00.000Z', day: '2026-10-10', message: 'chore: bot', additions: 100, deletions: 100 },
  { hash: 'f'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2026-10-05T12:00:00.000Z', day: '2026-10-05', message: 'feat: início', additions: 1, deletions: 0 },
  { hash: '0'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2020-01-01T12:00:00.000Z', day: '2020-01-01', message: 'feat: antigo', additions: 8, deletions: 3 },
]

function makeFixture(inputRows: ReportCommitRow[], teamName = 'Plataforma') {
  const rows = [...inputRows].sort(compareReportCommitRows)
  const dailyMap = new Map<string, { day: string, repo: string, author: string, scope?: 'integration' | 'branch', commits: number, additions: number, deletions: number, weekend: number, night: number }>()
  for (const row of rows) {
    const key = JSON.stringify([row.day, row.repo, row.author, row.scope ?? 'prod'])
    const current = dailyMap.get(key) ?? { day: row.day, repo: row.repo, author: row.author, ...(row.scope ? { scope: row.scope } : {}), commits: 0, additions: 0, deletions: 0, weekend: 0, night: 0 }
    current.commits++
    current.additions += row.additions
    current.deletions += row.deletions
    dailyMap.set(key, current)
  }
  const authors = [...new Set(rows.map(row => row.author))].sort()
  const repos = [...new Set(rows.map(row => row.repo))].sort()
  const statsData: Stats = {
    generatedAt: GENERATED_AT,
    repos,
    repoUrls: Object.fromEntries(repos.map(repo => [repo, repo === 'demo-web' ? 'http://inseguro.example/repo' : 'https://github.com/example/repo'])),
    authors: authors.map(name => ({ name, emails: [], bot: /bot/i.test(name) })),
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
    perRepo: repos.map((repo) => {
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
    }),
    perAuthor: authors.map((author) => {
      const selected = rows.filter(row => row.author === author)
      return {
        author,
        commits: selected.length,
        additions: selected.reduce((sum, row) => sum + row.additions, 0),
        deletions: selected.reduce((sum, row) => sum + row.deletions, 0),
        repos: new Set(selected.map(row => row.repo)).size,
        activeDays: new Set(selected.map(row => row.day)).size,
        lastCommit: selected.map(row => row.date).sort().at(-1) ?? '',
        streak: 0,
        longestStreak: 0,
      }
    }),
    weekly: [],
    monthly: [],
    heatmap: [],
  }
  const teamData: TeamData = {
    generatedAt: GENERATED_AT,
    devs: authors.map(name => ({ name, title: null, description: null, emails: [], githubLogins: [], teams: name === 'CI Bot' ? [] : [teamName], bot: /bot/i.test(name) })),
    teams: [{ name: teamName, description: null, color: null, members: authors.filter(name => name === 'Ana') }],
    candidates: [],
  }
  return {
    rows,
    log: { generatedAt: GENERATED_AT, commits: rows } satisfies ReportCommitsData,
    dailyRows: [...dailyMap.values()],
    statsData,
    teamData,
  }
}

function seed(rows = BASE_ROWS, teamName?: string) {
  const fixture = makeFixture(rows, teamName)
  stats.value = fixture.statsData
  daily.value = fixture.dailyRows
  dailyGeneratedAt.value = GENERATED_AT
  dailyError.value = null
  dailyLoading.value = false
  reportCommits.value = fixture.log
  reportCommitsLoading.value = false
  reportCommitsError.value = null
  reportCommitsActive.value = true
  team.value = fixture.teamData
  github.value = null
  releases.value = null
  return fixture
}

function build(subject: ReportSubject = { kind: 'org' }, commits = true) {
  const window = presetWindow('last-week', NOW)
  return buildReport(subject, window.from, window.to, window.inProgress, { commits })
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  stats.value = null
  daily.value = null
  dailyGeneratedAt.value = null
  dailyError.value = null
  dailyLoading.value = false
  reportCommits.value = null
  reportCommitsLoading.value = false
  reportCommitsError.value = null
  reportCommitsActive.value = false
  team.value = null
  github.value = null
  releases.value = null
})

describe('buildReport com anexo reconciliado', () => {
  it('emite a seção final completa para org, com H3, subtotais, escopos, empates e links HTTPS', () => {
    seed()
    const result = build()!

    expect(result.exportReady).toBe(true)
    expect(result.exportError).toBeNull()
    expect(result.markdown).toContain('## Anexo - commits por dev')
    expect(result.markdown).toContain('### Ana\n- **subtotal: 4 commits** · +10/-3 · prod 2 · progresso 2')
    expect(result.markdown).toContain('### Beto\n- **subtotal: 1 commit** · +5/-1 · prod 1 · progresso 0')
    expect(result.markdown).not.toContain('### CI Bot')
    expect(result.markdown).toContain(`- [aaaaaaa](https://github.com/example/repo/commit/${'a'.repeat(40)}) · 2026-10-10 · demo-api · +2/-1 · prod · feat: seguro`)
    expect(result.markdown).toContain(`- [bbbbbbb](https://github.com/example/repo/commit/${'b'.repeat(40)}) · 2026-10-10 · demo-api · +3/-0 · progresso · Merge relato preservado`)
    expect(result.markdown).toContain('- ccccccc · 2026-10-10 · demo-web · +4/-2 · progresso · fix: branch')
    expect(result.markdown).not.toContain('http://inseguro.example')
    expect(result.markdown.trim().endsWith('2020-01-01 · demo-api · +8/-3 · prod · feat: antigo')).toBe(false)

    const appendix = result.markdown.slice(result.markdown.indexOf('## Anexo - commits por dev'))
    const ana = appendix.slice(appendix.indexOf('### Ana'), appendix.indexOf('### Beto'))
    expect(ana.indexOf('[aaaaaaa]')).toBeLessThan(ana.indexOf('bbbbbbb'))
    expect(ana.indexOf('bbbbbbb')).toBeLessThan(ana.indexOf('ccccccc'))
    expect(result.markdown.lastIndexOf('## Anexo - commits por dev')).toBeGreaterThan(result.markdown.indexOf('## Commits'))
  })

  it('usa a mesma seção e o recorte canônico para time e dev', () => {
    seed()
    const time = build({ kind: 'team', team: 'Plataforma' })!
    const dev = build({ kind: 'dev', dev: 'Beto' })!

    expect(time.exportReady).toBe(true)
    expect(time.markdown).toContain('### Ana')
    expect(time.markdown).not.toContain('### Beto')
    expect(time.markdown).toContain('**subtotal: 4 commits**')
    expect(dev.exportReady).toBe(true)
    expect(dev.markdown).toContain('## Anexo - commits por dev')
    expect(dev.markdown).toContain('### Beto')
    expect(dev.markdown).not.toContain('### Ana')
    expect(dev.markdown).toContain('**subtotal: 1 commit**')
  })

  it('aceita zero reconciliado e mantém exportReady=true', () => {
    seed()
    const window = customWindow('2030-01-01', '2030-01-31', NOW)
    const result = buildReport({ kind: 'org' }, window.from, window.to, window.inProgress, { commits: true })!

    expect(result.exportReady).toBe(true)
    expect(result.exportError).toBeNull()
    expect(result.markdown).toContain('## Anexo - commits por dev\n- 0 commits reconciliados no recorte')
    expect(result.markdown).not.toContain('### Ana')
  })

  it('não altera o shape nem o conteúdo default e resumo semanal não carrega nem emite commits', () => {
    seed()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    reportCommitsActive.value = false

    const normal = build({ kind: 'org' }, false)!
    const weekly = buildWeeklySummary()!

    expect(Object.keys(normal).sort()).toEqual(['from', 'markdown', 'title', 'to'])
    expect(normal.markdown).not.toContain('## Anexo - commits por dev')
    expect(weekly.markdown).not.toContain('## Anexo - commits por dev')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('não trunca mais de 100 bullets nem janela maior que 400 dias', () => {
    const rows: ReportCommitRow[] = Array.from({ length: 130 }, (_, index) => ({
      hash: index.toString(16).padStart(40, '0'),
      repo: 'demo-api',
      author: 'Ana',
      date: new Date(Date.UTC(2026, 9, 15, 12) - index * 1000).toISOString(),
      day: '2026-10-15',
      message: `feat: ${index}`,
      additions: 1,
      deletions: 0,
    }))
    rows.push({ hash: 'f'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2020-01-01T12:00:00.000Z', day: '2020-01-01', message: 'feat: antigo', additions: 1, deletions: 0 })
    seed(rows)
    const window = customWindow('2020-01-01', '2026-10-15', NOW)
    const result = buildReport({ kind: 'org' }, window.from, window.to, window.inProgress, { commits: true })!
    const appendix = result.markdown.slice(result.markdown.indexOf('## Anexo - commits por dev'))

    expect(result.exportReady).toBe(true)
    expect(appendix.split('\n').filter(line => line.startsWith('- ['))).toHaveLength(131)
    expect(appendix).toContain('**subtotal: 131 commits**')
    expect(appendix).toContain('feat: antigo')
  })

  it('escapa nomes, títulos, repos e assuntos hostis no markdown e no preview', () => {
    const author = 'Ana <img> **admin**'
    const row: ReportCommitRow = {
      hash: 'a'.repeat(40),
      repo: 'demo-<api>',
      author,
      date: '2026-10-10T12:00:00.000Z',
      day: '2026-10-10',
      message: 'feat: <script>alert(1)</script>\r\n## injetado [x](javascript:alert(1)) &lt;',
      additions: 1,
      deletions: 0,
    }
    seed([row])
    const result = build({ kind: 'dev', dev: author })!
    const html = renderMarkdown(result.markdown)

    expect(result.exportReady).toBe(true)
    expect(result.title).toContain(` · ${author} —`)
    expect(result.markdown.split('\n')[0]).toBe(`# ${mdText(result.title)}`)
    const renderedTitle = renderMarkdown(result.markdown.split('\n')[0])
    expect(renderedTitle).toContain('Ana &lt;img&gt; **admin**')
    expect(renderedTitle).not.toContain('\\')
    expect(result.markdown).toContain('### Ana \\<img\\> \\*\\*admin\\*\\*')
    expect(result.markdown).toContain('demo-\\<api\\>')
    expect(result.markdown).toContain('feat: \\<script\\>alert(1)\\</script\\> ## injetado \\[x\\](javascript:alert(1)) \\&lt;')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<strong>admin</strong>')
    expect(html).not.toContain('<h2>injetado</h2>')
  })

  it('escapa também o nome do time no título e nas linhas do resumo', () => {
    seed(BASE_ROWS, 'Time <script> **x**')
    const result = build({ kind: 'team', team: 'Time <script> **x**' })!
    const h1 = result.markdown.split('\n')[0]

    expect(result.title).toContain(' · Time <script> **x** —')
    expect(h1).toBe(`# ${mdText(result.title)}`)
    expect(renderMarkdown(h1)).toContain('Time &lt;script&gt; **x**')
    expect(renderMarkdown(h1)).not.toContain('\\')
    expect(result.markdown).toContain('Time \\<script\\> \\*\\*x\\*\\*')
    expect(renderMarkdown(result.markdown)).not.toContain('<script')
  })
})

describe('buildReport fail-closed com commits=1', () => {
  it.each([
    ['log carregando', () => { reportCommitsLoading.value = true }, /carregando/i],
    ['daily carregando', () => { dailyLoading.value = true }, /daily.*carregando/i],
    ['erro de rede/HTTP do log', () => {
      reportCommits.value = null
      reportCommitsError.value = 'HTTP 500'
    }, /HTTP 500/],
    ['daily ausente', () => { daily.value = null }, /daily/i],
    ['erro do daily', () => {
      daily.value = null
      dailyError.value = 'HTTP 404'
    }, /daily|HTTP 404/i],
    ['snapshot do log divergente', () => { reportCommits.value = { ...reportCommits.value!, generatedAt: '2026-10-15T12:00:00.001Z' } }, /snapshot|diverg/i],
    ['snapshot do daily divergente', () => { dailyGeneratedAt.value = '2026-10-15T12:00:00.001Z' }, /snapshot|diverg/i],
    ['shape inválido', () => { reportCommits.value = { generatedAt: GENERATED_AT, commits: [{}] } as unknown as ReportCommitsData }, /hash|shape|inválid/i],
    ['daily divergente', () => { daily.value![0].commits++ }, /daily|diverg/i],
    ['stats divergente', () => { stats.value!.totals.commits++ }, /stats|diverg/i],
  ])('suprime o anexo inteiro e bloqueia exportReady com %s', (_name, mutate, expected) => {
    seed()
    const baseline = build()!.markdown
    mutate()
    const result = build()!

    expect(result.exportReady).toBe(false)
    expect(result.exportError).toMatch(expected)
    expect(result.markdown).not.toContain('## Anexo - commits por dev')
    expect(result.markdown).toContain('## Commits')
    expect(result.markdown.length).toBeGreaterThan(0)
    expect(baseline).toContain('## Anexo - commits por dev')
  })

  it('resume múltiplas divergências na primeira causa sem despejar o log inteiro no alerta', () => {
    seed()
    daily.value![0].commits++
    stats.value!.totals.commits++

    const result = build()!

    expect(result.exportReady).toBe(false)
    expect(result.exportError).toContain('daily.json')
    expect(result.exportError).not.toContain('stats.json.totals.commits')
  })

  it('volta a exportar depois que a divergência é resolvida', () => {
    seed()
    daily.value![0].commits++
    expect(build()!.exportReady).toBe(false)
    seed()
    expect(build()!.exportReady).toBe(true)
  })
})
