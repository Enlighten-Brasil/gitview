import { describe, expect, it } from 'vitest'
import { daysSince, fmtCompact, fmtDate, fmtDateTime, fmtDateTimeShort, fmtDay, fmtDaysAgo, fmtDuration, fmtInt, fmtRatio, median } from '../src/format'

/**
 * Issue #249 — comportamento DEFAULT pt-BR byte-idêntico: os literais abaixo
 * são a garantia cruzada que o Programa i18n (#253) vai comparar antes de
 * trocar a implementação. Datas sempre com componentes LOCAIS (sem string ISO)
 * para o teste não amarrar ao fuso da máquina.
 */
describe('fmtInt', () => {
  it('agrupa milhar pt-BR', () => {
    expect(fmtInt(1_234_567)).toBe('1.234.567')
    expect(fmtInt(999)).toBe('999')
    expect(fmtInt(-1000)).toBe('-1.000')
  })
})

describe('fmtCompact', () => {
  it('escolhe a unidade pela magnitude e usa vírgula decimal', () => {
    expect(fmtCompact(2_200_000)).toBe('2,2M')
    expect(fmtCompact(350_000)).toBe('350k')
    expect(fmtCompact(10_000)).toBe('10k')
    expect(fmtCompact(1_234)).toBe('1.234')
    expect(fmtCompact(9_999)).toBe('9.999')
  })
})

describe('fmtRatio', () => {
  it('uma casa decimal com vírgula', () => {
    expect(fmtRatio(1.5)).toBe('1,5')
    expect(fmtRatio(2)).toBe('2,0')
    expect(fmtRatio(0.25)).toBe('0,3')
  })
})

describe('fmtDuration', () => {
  it('faixas: <1h / horas arredondadas / dias / semanas', () => {
    expect(fmtDuration(0.5)).toBe('<1h')
    expect(fmtDuration(1)).toBe('1h')
    expect(fmtDuration(17.6)).toBe('18h')
    expect(fmtDuration(47.6)).toBe('48h')
    // 48h vira dia — Math.round só vale dentro da faixa de horas
    expect(fmtDuration(48)).toBe('2,0d')
    expect(fmtDuration(300)).toBe('12,5d')
    expect(fmtDuration(336)).toBe('2,0sem')
    expect(fmtDuration(720)).toBe('4,3sem')
  })
})

describe('fmtDate / fmtDay', () => {
  it('data curta dd/mm/aaaa e "—" sem data', () => {
    expect(fmtDate(new Date(2026, 9, 15))).toBe('15/10/2026')
    expect(fmtDate(null)).toBe('—')
    expect(fmtDate(undefined)).toBe('—')
    expect(fmtDate('')).toBe('—')
    expect(fmtDay(new Date(2026, 9, 15))).toBe('15/10')
  })
})

describe('fmtDateTime / fmtDateTimeShort', () => {
  it('data+hora pt-BR, "—" sem data e em data inválida', () => {
    expect(fmtDateTime(new Date(2026, 9, 15, 14, 30, 5))).toBe('15/10/2026, 14:30:05')
    expect(fmtDateTime(null)).toBe('—')
    expect(fmtDateTimeShort(new Date(2026, 9, 15, 14, 5))).toBe('15/10/2026, 14:05')
    expect(fmtDateTimeShort('not-a-date')).toBe('—')
    expect(fmtDateTimeShort('')).toBe('—')
  })
})

describe('daysSince / fmtDaysAgo', () => {
  it('conta dias inteiros até hoje e rotula hoje/ontem/há Nd', () => {
    const now = Date.now()
    expect(daysSince(new Date(now).toISOString())).toBe(0)
    expect(daysSince(new Date(now - 3 * 86_400_000).toISOString())).toBe(3)
    expect(fmtDaysAgo(new Date(now).toISOString())).toBe('hoje')
    expect(fmtDaysAgo(new Date(now - 86_400_000).toISOString())).toBe('ontem')
    expect(fmtDaysAgo(new Date(now - 5 * 86_400_000).toISOString())).toBe('há 5d')
  })
})

describe('median', () => {
  it('par -> média dos centrais, ímpar -> o central, vazio -> 0', () => {
    expect(median([])).toBe(0)
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('não muta a entrada (ordena cópia)', () => {
    const arr = [3, 1, 2]
    expect(median(arr)).toBe(2)
    expect(arr).toEqual([3, 1, 2])
  })
})
