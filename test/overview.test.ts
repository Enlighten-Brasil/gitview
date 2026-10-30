import { describe, expect, it } from 'vitest'
import { isoWeekMonday } from '../src/date'
import { offHoursShare, topDevs, typeMix, weeklyPrFlow } from '../src/overview'

/**
 * Painéis novos da Visão geral — fluxo de PRs por semana, top devs (join de
 * commits × PRs), mix de tipos e fração de fora do horário do time. Fixtures
 * derivadas de isoWeekMonday para não depender do fuso/fuso da execução.
 */

const WEEKS = ['2026-W10', '2026-W11', '2026-W12'] as const

/** ISO date `addDays` dias depois da segunda UTC da semana (sempre dentro dela) */
function day(week: string, addDays: number): string {
  const d = isoWeekMonday(week)
  expect(d).not.toBeNull()
  d!.setUTCDate(d!.getUTCDate() + addDays)
  return d!.toISOString()
}

describe('weeklyPrFlow', () => {
  it('conta criados por semana e mergeados pela semana do merge', () => {
    const prs = [
      { createdAt: day('2026-W10', 0), mergedAt: day('2026-W11', 2) },
      { createdAt: day('2026-W11', 1), mergedAt: null },
    ]
    expect(weeklyPrFlow(prs, WEEKS)).toEqual([
      { week: '2026-W10', opened: 1, merged: 0 },
      { week: '2026-W11', opened: 1, merged: 1 },
      { week: '2026-W12', opened: 0, merged: 0 },
    ])
  })

  it('ignora PRs criados/mergeados fora da janela', () => {
    const prs = [
      { createdAt: day('2026-W01', 0), mergedAt: day('2026-W12', 0) },
      { createdAt: day('2026-W10', 3), mergedAt: day('2026-W20', 0) },
    ]
    expect(weeklyPrFlow(prs, WEEKS)).toEqual([
      { week: '2026-W10', opened: 1, merged: 0 },
      { week: '2026-W11', opened: 0, merged: 0 },
      { week: '2026-W12', opened: 0, merged: 1 },
    ])
  })

  it('mesma semana cria e merge — conta nos dois eixos', () => {
    const prs = [{ createdAt: day('2026-W12', 1), mergedAt: day('2026-W12', 4) }]
    expect(weeklyPrFlow(prs, WEEKS)[2]).toEqual({ week: '2026-W12', opened: 1, merged: 1 })
  })

  it('janela vazia devolve lista vazia', () => {
    expect(weeklyPrFlow([{ createdAt: day('2026-W10', 0), mergedAt: null }], [])).toEqual([])
  })
})

describe('topDevs', () => {
  const commits = [
    { author: 'Ana', commits: 10 },
    { author: 'Beto', commits: 30 },
    { author: 'Cris', commits: 5 },
    { author: 'Duda', commits: 1 },
  ]
  const prs = new Map([['Beto', 2], ['Ana', 7]])

  it('ordena por commits, une PRs por dev e agrega o resto', () => {
    const res = topDevs(commits, prs, 2)
    expect(res.rows).toEqual([
      { author: 'Beto', commits: 30, prs: 2 },
      { author: 'Ana', commits: 10, prs: 7 },
    ])
    expect(res.rest).toEqual({ devs: 2, commits: 6, prs: 0 })
  })

  it('dev sem PRs merged conta 0', () => {
    expect(topDevs([{ author: 'Ana', commits: 1 }], new Map(), 5).rows)
      .toEqual([{ author: 'Ana', commits: 1, prs: 0 }])
  })

  it('empate de commits desempata por nome; rest null quando todo mundo cabe', () => {
    const res = topDevs([{ author: 'Beto', commits: 2 }, { author: 'Ana', commits: 2 }], new Map(), 5)
    expect(res.rows.map(r => r.author)).toEqual(['Ana', 'Beto'])
    expect(res.rest).toBeNull()
  })
})

describe('typeMix', () => {
  it('agrupa tipos fora da taxonomia em "outros", ordena por volume e arredonda %', () => {
    const mix = typeMix([
      { type: 'feat', commits: 3 },
      { type: 'fix', commits: 1 },
      { type: 'docs', commits: 4 }, // → outros
      { type: 'style', commits: 0 }, // zero some
    ])
    expect(mix).toEqual([
      { type: 'outros', commits: 4, pct: 50 },
      { type: 'feat', commits: 3, pct: 37.5 },
      { type: 'fix', commits: 1, pct: 12.5 },
    ])
  })

  it('sem commits devolve lista vazia', () => {
    expect(typeMix([])).toEqual([])
    expect(typeMix([{ type: 'feat', commits: 0 }])).toEqual([])
  })
})

describe('offHoursShare', () => {
  const rows = [
    { week: '2026-W10', commits: 10, weekend: 2, night: 1 },
    { week: '2026-W11', commits: 6, weekend: 0, night: 2 },
    { week: '2026-W05', commits: 100, weekend: 50, night: 50 }, // fora da janela
  ]

  it('soma só a janela e usa TODOS os commits como denominador', () => {
    expect(offHoursShare(rows, ['2026-W10', '2026-W11'])).toEqual({
      weekend: 2,
      night: 3,
      total: 16,
      pct: 5 / 16,
    })
  })

  it('sem commits na janela devolve pct 0', () => {
    expect(offHoursShare(rows, ['2026-W01'])).toEqual({ weekend: 0, night: 0, total: 0, pct: 0 })
  })
})
