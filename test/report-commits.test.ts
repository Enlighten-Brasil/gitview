import type { DailyRow, ReportCommitRow } from '../src/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { selectReportCommitWindow } from '../src/report-commits'

const GENERATED_AT = '2026-10-26T12:00:00.000Z'
const EMPTY = { generatedAt: GENERATED_AT, commits: [] }

function jsonResponse(json: unknown, contentType = 'application/json') {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => name === 'content-type' ? contentType : null },
    json: async () => json,
  }
}

function httpResponse(status: number) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => ({}),
  }
}

async function freshModule() {
  vi.resetModules()
  return import('../src/report-commits-loader')
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('loader lazy de report-commits', () => {
  it('não faz request no import nem com o anexo OFF', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const module = await freshModule()

    await module.setReportCommitsActive(false)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(module.reportCommits.value).toBeNull()
    expect(module.reportCommitsLoading.value).toBe(false)
    expect(module.reportCommitsError.value).toBeNull()
    expect(module.reportCommitsActive.value).toBe(false)
  })

  it('deduplica requests ON simultâneos e reutiliza o cache', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(EMPTY))
    vi.stubGlobal('fetch', fetchMock)
    const module = await freshModule()

    await Promise.all([module.setReportCommitsActive(true), module.setReportCommitsActive(true)])
    await module.setReportCommitsActive(true)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/report-commits.json`)
    expect(module.reportCommits.value).toEqual(EMPTY)
    expect(module.reportCommitsError.value).toBeNull()
  })

  it('expõe loading e faz cache-bust somente no force explícito', async () => {
    let resolveFetch!: (value: ReturnType<typeof jsonResponse>) => void
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<ReturnType<typeof jsonResponse>>((resolve) => { resolveFetch = resolve }))
      .mockImplementation(async () => jsonResponse(EMPTY))
    vi.stubGlobal('fetch', fetchMock)
    const module = await freshModule()

    const first = module.setReportCommitsActive(true)
    expect(module.reportCommitsLoading.value).toBe(true)
    resolveFetch(jsonResponse(EMPTY))
    await first
    expect(module.reportCommitsLoading.value).toBe(false)

    vi.useFakeTimers({ now: 1_793_000_000_000 })
    await module.loadReportCommits(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe(`${import.meta.env.BASE_URL}data/report-commits.json?t=1793000000000`)
    vi.useRealTimers()
  })

  it.each([
    ['404', () => httpResponse(404), /HTTP 404/],
    ['500', () => httpResponse(500), /HTTP 500/],
    ['HTML no fallback do SPA', () => jsonResponse('<!doctype html>', 'text/html'), /HTTP 404/],
    ['shape inválido', () => jsonResponse({ generatedAt: GENERATED_AT, commits: [{}] }), /hash/],
    ['snapshot sem generatedAt', () => jsonResponse({ commits: [] }), /generatedAt/],
  ])('falha fechado com %s e nunca vira lista vazia', async (_name, response, expected) => {
    vi.stubGlobal('fetch', vi.fn(async () => response()))
    const module = await freshModule()

    await module.setReportCommitsActive(true)

    expect(module.reportCommits.value).toBeNull()
    expect(module.reportCommitsLoading.value).toBe(false)
    expect(module.reportCommitsError.value).toMatch(expected)
  })

  it('falha fechado com erro de rede', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed')
    }))
    const module = await freshModule()

    await module.setReportCommitsActive(true)

    expect(module.reportCommits.value).toBeNull()
    expect(module.reportCommitsError.value).toBe('fetch failed')
  })

  it('descarta o snapshot antigo quando o refresh falha', async () => {
    let fail = false
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (fail)
        throw new TypeError('offline')
      return jsonResponse(EMPTY)
    }))
    const module = await freshModule()
    await module.setReportCommitsActive(true)
    expect(module.reportCommits.value).toEqual(EMPTY)

    fail = true
    await module.loadReportCommits(true)

    expect(module.reportCommits.value).toBeNull()
    expect(module.reportCommitsError.value).toBe('offline')
  })

  it('invalida resposta antiga mesmo quando ela chega depois do refresh', async () => {
    const pending: Array<(value: ReturnType<typeof jsonResponse>) => void> = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
      pending.push(resolve)
    })))
    const module = await freshModule()

    const oldRequest = module.setReportCommitsActive(true)
    const newRequest = module.loadReportCommits(true)
    expect(pending).toHaveLength(2)
    const fresh = { generatedAt: '2026-10-26T12:00:00.001Z', commits: [] }
    pending[1](jsonResponse(fresh))
    await newRequest
    pending[0](jsonResponse(EMPTY))
    await oldRequest

    expect(module.reportCommits.value).toEqual(fresh)
    expect(module.reportCommitsError.value).toBeNull()
    expect(module.reportCommitsLoading.value).toBe(false)
  })

  it('uma resposta antiga não ressuscita dados após falha do refresh mais recente', async () => {
    const pending: Array<(value: ReturnType<typeof jsonResponse>) => void> = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
      pending.push(resolve)
    })))
    const module = await freshModule()

    const oldRequest = module.setReportCommitsActive(true)
    const newRequest = module.loadReportCommits(true)
    pending[1](jsonResponse({ generatedAt: GENERATED_AT, commits: [{}] }))
    await newRequest
    pending[0](jsonResponse(EMPTY))
    await oldRequest

    expect(module.reportCommits.value).toBeNull()
    expect(module.reportCommitsError.value).toMatch(/hash/)
  })
})

function dailyOf(rows: ReportCommitRow[]): DailyRow[] {
  const groups = new Map<string, DailyRow>()
  for (const row of rows) {
    const key = JSON.stringify([row.day, row.repo, row.author, row.scope ?? 'prod'])
    const current = groups.get(key) ?? {
      day: row.day,
      repo: row.repo,
      author: row.author,
      ...(row.scope ? { scope: row.scope } : {}),
      commits: 0,
      additions: 0,
      deletions: 0,
      weekend: 0,
      night: 0,
    }
    current.commits++
    current.additions += row.additions
    current.deletions += row.deletions
    groups.set(key, current)
  }
  return [...groups.values()]
}

const SELECTION_ROWS: ReportCommitRow[] = [
  { hash: 'a'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2026-10-16T02:30:00.000Z', day: '2026-10-15', message: 'feat: produção', additions: 5, deletions: 1 },
  { hash: 'b'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2026-10-16T01:00:00.000Z', day: '2026-10-15', message: 'fix: integração', additions: 3, deletions: 2, scope: 'integration' },
  { hash: 'c'.repeat(40), repo: 'demo-web', author: 'Ana', date: '2026-10-16T01:00:00.000Z', day: '2026-10-15', message: 'Merge relato preservado', additions: 2, deletions: 0, scope: 'branch' },
  { hash: 'd'.repeat(40), repo: 'demo-web', author: 'Beto', date: '2026-10-16T01:00:00.000Z', day: '2026-10-15', message: 'feat: Beto', additions: 20, deletions: 4 },
  { hash: 'e'.repeat(40), repo: 'demo-api', author: 'CI Bot', date: '2026-10-16T01:00:00.000Z', day: '2026-10-15', message: 'chore: bot', additions: 100, deletions: 100 },
  { hash: 'f'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2026-10-14T12:00:00.000Z', day: '2026-10-14', message: 'feat: anterior', additions: 50, deletions: 50 },
]

describe('seleção e reconciliação dia-exata do anexo', () => {
  it('usa day canônico, exclui bots, aplica assunto e reconcilia autores/repos/linhas/escopos', () => {
    const result = selectReportCommitWindow(SELECTION_ROWS, dailyOf(SELECTION_ROWS), {
      fromDay: '2026-10-15',
      toDay: '2026-10-15',
      includeAuthor: author => author === 'Ana',
    })

    expect(result.errors).toEqual([])
    expect(result.rows.map(row => row.hash[0])).toEqual(['a', 'b', 'c'])
    expect(result.totals).toEqual({ commits: 3, additions: 10, deletions: 3, prodCommits: 1, progressCommits: 2 })
    expect(result.byAuthor.get('Ana')).toEqual(result.totals)
    expect(result.byRepo.get('demo-api')).toEqual({ commits: 2, additions: 8, deletions: 3, prodCommits: 1, progressCommits: 1 })
    expect(result.byRepo.get('demo-web')).toEqual({ commits: 1, additions: 2, deletions: 0, prodCommits: 0, progressCommits: 1 })
    expect(result.rows.some(row => row.message.startsWith('Merge'))).toBe(true)
    expect(result.rows.some(row => row.day === '2026-10-14')).toBe(false)
  })

  it('aceita zero reconciliado sem transformar ausência em divergência', () => {
    const result = selectReportCommitWindow(SELECTION_ROWS, dailyOf(SELECTION_ROWS), {
      fromDay: '2030-01-01',
      toDay: '2030-01-02',
      includeAuthor: () => true,
    })

    expect(result.errors).toEqual([])
    expect(result.rows).toEqual([])
    expect(result.totals.commits).toBe(0)
    expect(result.byAuthor.size).toBe(0)
  })

  it.each([
    ['commits', (row: DailyRow) => { row.commits++ }],
    ['additions', (row: DailyRow) => { row.additions++ }],
    ['deletions', (row: DailyRow) => { row.deletions++ }],
    ['scope', (row: DailyRow) => { row.scope = 'branch' }],
    ['day', (row: DailyRow) => { row.day = '2026-10-14' }],
    ['repo', (row: DailyRow) => { row.repo = 'demo-other' }],
    ['author', (row: DailyRow) => { row.author = 'Beto' }],
  ])('suprime a seleção quando daily diverge em %s', (_field, mutate) => {
    const daily = dailyOf(SELECTION_ROWS)
    mutate(daily[0])
    const result = selectReportCommitWindow(SELECTION_ROWS, daily, {
      fromDay: '2026-10-15',
      toDay: '2026-10-15',
      includeAuthor: author => author === 'Ana',
    })

    expect(result.errors).not.toEqual([])
  })

  it('não trunca mais de 100 commits nem janela maior que 400 dias', () => {
    const rows: ReportCommitRow[] = Array.from({ length: 130 }, (_, index) => ({
      hash: index.toString(16).padStart(40, '0'),
      repo: 'demo-api',
      author: 'Ana',
      date: new Date(Date.UTC(2026, 9, 15, 12, 0, 0) - index * 1000).toISOString(),
      day: '2026-10-15',
      message: `feat: ${index}`,
      additions: 1,
      deletions: 0,
    }))
    rows.push({ hash: 'f'.repeat(40), repo: 'demo-api', author: 'Ana', date: '2020-01-01T12:00:00.000Z', day: '2020-01-01', message: 'feat: antigo', additions: 1, deletions: 0 })

    const result = selectReportCommitWindow(rows, dailyOf(rows), {
      fromDay: '2020-01-01',
      toDay: '2026-10-15',
      includeAuthor: author => author === 'Ana',
    })

    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(131)
    expect(result.totals.commits).toBe(131)
  })
})
