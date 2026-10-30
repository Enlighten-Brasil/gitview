import { describe, expect, it } from 'vitest'
import { isoWeekKeyBefore } from '../src/date'
import { weeklyWins } from '../src/weeklyWinners'

/**
 * Campeão da semana por EVOLUÇÃO — fórmula extraída do WeeklyChampions
 * (issue #10 + follow-up #12 + issue #25): piso de commits, baseline em
 * semanas calendário, recorte por período e desempates.
 */

/** linhas rápidas: autor → { semana → commits } */
function rows(map: Record<string, Record<string, number>>): { week: string, author: string, commits: number }[] {
  return Object.entries(map).flatMap(([author, byWeek]) =>
    Object.entries(byWeek).map(([week, commits]) => ({ author, week, commits })),
  )
}

describe('weeklyWins', () => {
  it('premia evolução, não volume — quem estoura na semana vence o produtivo constante', () => {
    // Ana commita só na W10 (3); Bruno commita 30 por semana desde W02
    const data = rows({
      Ana: { '2026-W10': 3 },
      Bruno: Object.fromEntries(['2026-W02', '2026-W03', '2026-W04', '2026-W05', '2026-W06', '2026-W07', '2026-W08', '2026-W09', '2026-W10'].map(w => [w, 30])),
    })
    const { wins } = weeklyWins(data)
    const last = wins[wins.length - 1]
    expect(last.week).toBe('2026-W10')
    expect(last.author).toBe('Ana')
    // baseline da Ana = 0 → ratio = 3 / (0/8 + 1)
    expect(last.ratio).toBe(3)
  })

  it('aplica o piso de commits — semana abaixo do mínimo não vira vitória', () => {
    const { wins } = weeklyWins(rows({ Ana: { '2026-W10': 2 } }))
    expect(wins).toEqual([])
    const custom = weeklyWins(rows({ Ana: { '2026-W10': 2 } }), { minCommits: 2 })
    expect(custom.wins).toHaveLength(1)
  })

  it('semana sem nenhuma anterior DENTRO do período fica fora do ranking (issue #25)', () => {
    const data = rows({ Ana: { '2026-W10': 5 } })
    const { wins } = weeklyWins(data, { isWeekInPeriod: w => w === '2026-W10' })
    expect(wins).toEqual([])
  })

  it('empate de ratio desempata por commits e depois por nome (estável)', () => {
    // ratios iguais (2×): Ana 4 commits sobre média 1; Bruno 6 sobre média 2
    const data = rows({
      Ana: { ...Object.fromEntries(['2026-W02', '2026-W03', '2026-W04', '2026-W05', '2026-W06', '2026-W07', '2026-W08', '2026-W09'].map(w => [w, 1])), '2026-W10': 4 },
      Bruno: { ...Object.fromEntries(['2026-W02', '2026-W03', '2026-W04', '2026-W05', '2026-W06', '2026-W07', '2026-W08', '2026-W09'].map(w => [w, 2])), '2026-W10': 6 },
    })
    const last = weeklyWins(data).wins.slice(-1)[0]
    expect(last.author).toBe('Bruno') // mesmo ratio, mais commits

    const tie = weeklyWins(rows({ Bruno: { '2026-W10': 3 }, Ana: { '2026-W10': 3 } })).wins.slice(-1)[0]
    expect(tie.author).toBe('Ana') // ratio e commits iguais — ordem alfabética
  })

  it('titleRank conta vitórias por dev em ordem estável', () => {
    const data = rows({
      Ana: { '2026-W08': 3, '2026-W10': 3 },
      Beto: { '2026-W09': 3 },
    })
    const { wins, titleRank, weeksWithWins } = weeklyWins(data)
    expect(weeksWithWins).toBe(3)
    expect(titleRank).toEqual([{ author: 'Ana', count: 2 }, { author: 'Beto', count: 1 }])
    expect(wins.map(w => w.week)).toEqual(['2026-W08', '2026-W09', '2026-W10'])
  })

  it('a baseline é calendário (N semanas ISO anteriores, vazias contando 0)', () => {
    // uma vitória com baselineWeeks 2 usa exatamente as 2 semanas anteriores
    const data = rows({
      Ana: { '2026-W08': 2, '2026-W09': 2, '2026-W10': 4 },
    })
    const last = weeklyWins(data, { baselineWeeks: 2, minCommits: 2 }).wins.slice(-1)[0]
    // prev = 2+2=4 → média 2 → ratio = 4 / (2 + 1)
    expect(last.ratio).toBeCloseTo(4 / 3)
    // e a janela realmente aponta as 2 semanas ISO anteriores de W10
    expect([isoWeekKeyBefore('2026-W10', 1), isoWeekKeyBefore('2026-W10', 2)]).toEqual(['2026-W09', '2026-W08'])
  })
})
