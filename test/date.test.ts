import { describe, expect, it } from 'vitest'
import { isoWeekKey, isoWeekKeyBefore, isoWeekMonday, quickRange } from '../src/date'

/** Semente da infra de testes (issue #248) — semana ISO é aritmética pura. */
describe('isoWeekKey', () => {
  it('semana 1 de 2026 começa em 2025-12-29 (segunda) e cobre até 2026-01-04', () => {
    expect(isoWeekKey(new Date(Date.UTC(2025, 11, 29)))).toBe('2026-W01')
    expect(isoWeekKey(new Date(Date.UTC(2026, 0, 4)))).toBe('2026-W01')
    expect(isoWeekKey(new Date(Date.UTC(2026, 0, 5)))).toBe('2026-W02')
  })
})

describe('isoWeekMonday', () => {
  it('é o inverso de isoWeekKey e rejeita chave malformada', () => {
    expect(isoWeekMonday('2026-W01')?.toISOString().slice(0, 10)).toBe('2025-12-29')
    expect(isoWeekMonday('2026-W02')?.toISOString().slice(0, 10)).toBe('2026-01-05')

    for (const key of ['2026-1', 'W01', '2026-W1', '2026-W99-x'])
      expect(isoWeekMonday(key)).toBeNull()

    // roundtrip só para chaves ISO válidas (53 = ano de 53 semanas, ex. 2026)
    for (const key of ['2024-W52', '2025-W52', '2026-W01', '2026-W47', '2026-W53'])
      expect(isoWeekKey(isoWeekMonday(key)!)).toBe(key)
  })
})

describe('isoWeekKeyBefore', () => {
  it('conta N semanas calendário para trás, inclusive a virada de ano', () => {
    expect(isoWeekKeyBefore('2026-W01', 1)).toBe('2025-W52')
    expect(isoWeekKeyBefore('2026-W01', 4)).toBe('2025-W49')
    expect(isoWeekKeyBefore('2026-W06', 5)).toBe('2026-W01')
  })

  it('propaga a chave inválida como null', () => {
    expect(isoWeekKeyBefore('bogus', 1)).toBeNull()
  })
})
describe('quickRange', () => {
  // sexta 2026-10-30 (UTC) — janelas em aritmética UTC, coerente com isoWeekKey
  const NOW = new Date(Date.UTC(2026, 9, 30))

  it('d7 cobre hoje-6..hoje', () => {
    expect(quickRange('d7', NOW)).toEqual({ from: '2026-10-24', to: '2026-10-30' })
  })

  it('thisWeek = seg..dom da semana ISO atual (2026-W44)', () => {
    expect(quickRange('thisWeek', NOW)).toEqual({ from: '2026-10-26', to: '2026-11-01' })
  })

  it('lastWeek = seg..dom da semana ISO anterior (2026-W43)', () => {
    expect(quickRange('lastWeek', NOW)).toEqual({ from: '2026-10-19', to: '2026-10-25' })
  })
})
