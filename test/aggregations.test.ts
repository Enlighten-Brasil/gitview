import type { MonthlyRow, MonthlyTypeRow, Stats, WeeklyRow } from '../src/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { burnout, commitsByAuthorPeriod, commitsByAuthorWeek, commitsByRepo, commitsByRepoPeriod, fixByRepo, groupBySum, nestBySum, offHoursPeriod, pace, previousTotals } from '../src/aggregations'
import { filters, stats } from '../src/data'
import { lastNWeekKeys } from '../src/date'

/**
 * Issue #249 — helpers de soma (puros) + a projeção computada consumida pelo
 * app (commitsByRepo), que exercita o filtro de período/bots junto. Fixture
 * mínima inline; o mês corrente é calculado para o corte de 12 meses não
 * depender do dia da execução.
 */
const MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`

const MONTHLY: MonthlyRow[] = [
  { month: MONTH, repo: 'demo-api', author: 'Ana', commits: 3, additions: 10, deletions: 2 },
  { month: MONTH, repo: 'demo-web', author: 'Ana', commits: 6, additions: 5, deletions: 1 },
  { month: MONTH, repo: 'demo-api', author: 'Beto', commits: 2, additions: 4, deletions: 4 },
  // bot (escondido por default) e mês fora da janela de 12 meses — não contam
  { month: MONTH, repo: 'demo-api', author: 'CI Bot', commits: 9, additions: 90, deletions: 9 },
  { month: '2024-01', repo: 'demo-api', author: 'Ana', commits: 100, additions: 1, deletions: 1 },
]

const STATS: Stats = {
  generatedAt: '2026-10-15T12:00:00.000Z',
  repos: ['demo-api', 'demo-web'],
  authors: [
    { name: 'Ana', emails: [], bot: false },
    { name: 'Beto', emails: [], bot: false },
    { name: 'CI Bot', emails: [], bot: true },
  ],
  totals: { commits: 25, prodCommits: 20, progressCommits: 5, additions: 100, deletions: 30, activeDays: 9, repos: 2, authors: 3 },
  perRepo: [],
  perAuthor: [],
  weekly: [],
  monthly: MONTHLY,
  heatmap: [],
}

beforeEach(() => {
  Object.assign(filters, {
    repos: [],
    authors: [],
    rangeMonths: 12,
    dateFrom: null,
    dateTo: null,
    showBots: false,
    workScope: 'all',
  })
  stats.value = STATS
})

describe('groupBySum', () => {
  it('soma commits por chave no default e por valFn quando pedida', () => {
    const rows = MONTHLY.slice(0, 3)
    expect([...groupBySum(rows, r => r.repo).entries()]).toEqual([
      ['demo-api', 5],
      ['demo-web', 6],
    ])
    expect([...groupBySum(rows, r => r.author, r => r.additions).entries()]).toEqual([
      ['Ana', 15],
      ['Beto', 4],
    ])
    expect(groupBySum<MonthlyRow>([], r => r.repo).size).toBe(0)
  })
})

describe('nestBySum', () => {
  it('agrega outer→inner (autor→semana por default)', () => {
    const rows: WeeklyRow[] = [
      { week: '2026-W41', repo: 'demo-api', author: 'Ana', commits: 2, weekend: 0, night: 0 },
      { week: '2026-W41', repo: 'demo-web', author: 'Ana', commits: 3, weekend: 0, night: 0 },
      { week: '2026-W42', repo: 'demo-api', author: 'Ana', commits: 1, weekend: 0, night: 0 },
      { week: '2026-W41', repo: 'demo-api', author: 'Beto', commits: 4, weekend: 0, night: 0 },
    ]
    const nested = nestBySum(rows, r => r.author, r => r.week)
    expect([...nested.get('Ana')!.entries()]).toEqual([['2026-W41', 5], ['2026-W42', 1]])
    expect([...nested.get('Beto')!.entries()]).toEqual([['2026-W41', 4]])

    const byWeek = commitsByAuthorWeek(rows)
    expect(byWeek.get('Ana')!.get('2026-W41')).toBe(5)
  })
})

describe('commitsByRepoPeriod / commitsByAuthorPeriod', () => {
  it('agrega linhas já filtradas e ordena por volume decrescente', () => {
    // helpers não filtram — o chamador passa as linhas do período (aqui, as 3 primeiras)
    expect(commitsByRepoPeriod(MONTHLY.slice(0, 3))).toEqual([
      { repo: 'demo-web', commits: 6 },
      { repo: 'demo-api', commits: 5 },
    ])
    expect(commitsByAuthorPeriod(MONTHLY)).toEqual([
      { author: 'Ana', commits: 109 },
      { author: 'CI Bot', commits: 9 },
      { author: 'Beto', commits: 2 },
    ])
  })
})

describe('fixByRepo', () => {
  it('pareia fix/total por repo — repo sem fix entra com 0', () => {
    const rows: MonthlyTypeRow[] = [
      { month: '2026-10', repo: 'demo-api', author: 'Ana', type: 'fix', commits: 2 },
      { month: '2026-10', repo: 'demo-api', author: 'Ana', type: 'feat', commits: 8 },
      { month: '2026-10', repo: 'demo-web', author: 'Beto', type: 'feat', commits: 3 },
    ]
    expect([...fixByRepo(rows).entries()]).toEqual([
      ['demo-api', { fix: 2, total: 10 }],
      ['demo-web', { fix: 0, total: 3 }],
    ])
  })
})

describe('commitsByRepo (computeds do store)', () => {
  it('só o período filtrado: bots escondidos e janela de 12 meses respeitada', () => {
    expect(commitsByRepo.value).toEqual([
      { repo: 'demo-web', commits: 6 },
      { repo: 'demo-api', commits: 5 },
    ])
  })
})

describe('pace (ritmo) / burnout / offHoursPeriod', () => {
  it('pace: últimas 4 semanas vs média das 8 anteriores, ordenado por ratio crescente', () => {
    const weeks = lastNWeekKeys(12)
    stats.value = {
      ...STATS,
      weekly: [
        // Ana: 2/semana nas 8 anteriores (média 2) e nas 4 recentes → ratio 1
        ...weeks.slice(0, 8).map(w => ({ week: w, repo: 'demo-api', author: 'Ana', commits: 2, weekend: 0, night: 0 })),
        ...weeks.slice(8).map(w => ({ week: w, repo: 'demo-api', author: 'Ana', commits: 2, weekend: 0, night: 0 })),
        // Beto: só recente (sem baseline → ratio null) — sobrevive pelo piso recent > 0
        ...weeks.slice(10).map(w => ({ week: w, repo: 'demo-api', author: 'Beto', commits: 2, weekend: 0, night: 0 })),
      ],
    }
    expect(pace.value).toEqual([
      { author: 'Beto', recent: 4, prevAvg: 0, ratio: null },
      { author: 'Ana', recent: 8, prevAvg: 2, ratio: 1 },
    ])
  })

  it('burnout: fim de semana conta uma vez por dev mesmo com 2 repos na mesma semana (#150)', () => {
    const weeks = lastNWeekKeys(8)
    stats.value = {
      ...STATS,
      weekly: [
        { week: weeks[7]!, repo: 'demo-api', author: 'Ana', commits: 3, weekend: 3, night: 1 },
        { week: weeks[7]!, repo: 'demo-web', author: 'Ana', commits: 2, weekend: 2, night: 0 },
        { week: weeks[6]!, repo: 'demo-api', author: 'Ana', commits: 4, weekend: 0, night: 4 },
      ],
    }
    expect(burnout.value).toEqual([
      { author: 'Ana', weekend: 5, night: 5, total: 9, offHoursPct: 10 / 9, weekendsActive: 1 },
    ])
  })

  it('offHoursPeriod: piso de commits do threshold, bots fora e ordenação por %', () => {
    const week = lastNWeekKeys(1)[0]!
    stats.value = {
      ...STATS,
      weekly: [
        { week, repo: 'demo-api', author: 'Ana', commits: 20, weekend: 10, night: 5 }, // 75%
        { week, repo: 'demo-api', author: 'Beto', commits: 20, weekend: 2, night: 0 }, // 10%
        { week, repo: 'demo-api', author: 'Zeca', commits: 19, weekend: 19, night: 0 }, // abaixo do piso (20)
        { week, repo: 'demo-api', author: 'Nina', commits: 40, weekend: 0, night: 0 }, // sem off-hours
        { week, repo: 'demo-api', author: 'CI Bot', commits: 30, weekend: 30, night: 0 }, // bot
      ],
    }
    expect(offHoursPeriod.value).toEqual([
      { author: 'Ana', total: 20, weekend: 10, night: 5, offHoursPct: 0.75 },
      { author: 'Beto', total: 20, weekend: 2, night: 0, offHoursPct: 0.1 },
    ])
  })
})

describe('previousTotals (delta dos cards)', () => {
  it('soma a janela anterior equivalente; null sem janela comparável', () => {
    // réplica do corte do módulo: cutoff = hoje − rangeMonths em calendário
    const cut = new Date()
    cut.setMonth(cut.getMonth() - 12)
    const prevStart = new Date(cut)
    prevStart.setMonth(prevStart.getMonth() - 12)
    const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const older = new Date(prevStart)
    older.setMonth(older.getMonth() - 2)

    stats.value = {
      ...STATS,
      monthly: [
        { month: key(prevStart), repo: 'demo-api', author: 'Ana', commits: 5, additions: 10, deletions: 2 },
        { month: key(prevStart), repo: 'demo-web', author: 'Beto', commits: 3, additions: 5, deletions: 1 },
        { month: key(cut), repo: 'demo-api', author: 'Ana', commits: 100, additions: 1, deletions: 1 }, // janela atual
        { month: key(older), repo: 'demo-api', author: 'Ana', commits: 99, additions: 1, deletions: 1 }, // antes da anterior
      ],
    }
    expect(previousTotals.value).toEqual({ commits: 8, additions: 15, deletions: 3, authors: 2, repos: 2 })

    filters.rangeMonths = null
    expect(previousTotals.value).toBeNull()
    filters.rangeMonths = 12
    filters.dateFrom = '2026-01-01'
    expect(previousTotals.value).toBeNull() // range customizado não tem janela-espelho
  })
})
