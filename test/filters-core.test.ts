import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { quickRange } from '../src/date'
import { authorSelected, cutoff, filters, inPeriodDay, inPeriodMonth, isCustomRange, isWorkScope, repoSelected, WORK_SCOPES } from '../src/filters-core'

/**
 * Issue #249 — janelas e escopo em filters-core. Relógio pinado (vi fake
 * timers) porque cutoff() é calculado a partir de `new Date()` sem injetar —
 * as janelas ficam determinísticas em qualquer fuso/ dia de execução.
 */
beforeEach(() => {
  vi.useFakeTimers({ now: new Date(2026, 9, 15, 12, 0, 0) })
  Object.assign(filters, {
    repos: [],
    authors: [],
    rangeMonths: 12,
    dateFrom: null,
    dateTo: null,
    showBots: false,
    workScope: 'all',
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('isWorkScope', () => {
  it('só a união fechada é válida', () => {
    expect(WORK_SCOPES).toEqual(['all', 'prod', 'progress'])
    for (const v of WORK_SCOPES)
      expect(isWorkScope(v)).toBe(true)
    expect(isWorkScope('banana')).toBe(false)
    expect(isWorkScope(12)).toBe(false)
    expect(isWorkScope(null)).toBe(false)
  })
})

describe('cutoff', () => {
  it('null sem janela (histórico completo)', () => {
    filters.rangeMonths = null
    expect(cutoff()).toBeNull()
  })

  it('dateFrom prevalece e é interpretado como início do dia', () => {
    filters.dateFrom = '2026-04-01'
    expect(cutoff()).toEqual(new Date(2026, 3, 1, 0, 0, 0, 0))
  })

  it('preset de meses volta o calendário a partir de agora', () => {
    filters.rangeMonths = 6
    expect(cutoff()).toEqual(new Date(2026, 3, 15, 12, 0, 0, 0))
    filters.rangeMonths = 12
    expect(cutoff()).toEqual(new Date(2025, 9, 15, 12, 0, 0, 0))
  })
})

describe('repoSelected / authorSelected', () => {
  it('lista vazia = todos; seleção filtra', () => {
    expect(repoSelected('demo-api')).toBe(true)
    filters.repos = ['demo-api']
    expect(repoSelected('demo-api')).toBe(true)
    expect(repoSelected('demo-web')).toBe(false)
  })

  it('bots ficam fora até ligar showBots, mesmo selecionados', () => {
    expect(authorSelected('Ana')).toBe(true)
    expect(authorSelected('CI Bot', true)).toBe(false)
    filters.showBots = true
    expect(authorSelected('CI Bot', true)).toBe(true)
    filters.authors = ['Ana']
    expect(authorSelected('Beto')).toBe(false)
    expect(authorSelected('Ana')).toBe(true)
    expect(authorSelected('CI Bot', true)).toBe(false) // bot continua fora sem seleção de bots
  })
})

describe('isCustomRange', () => {
  it('basta uma das pontas para ser custom', () => {
    expect(isCustomRange()).toBe(false)
    filters.dateFrom = '2026-01-01'
    expect(isCustomRange()).toBe(true)
    filters.dateFrom = null
    filters.dateTo = '2026-06-30'
    expect(isCustomRange()).toBe(true)
  })
})

describe('inPeriodMonth', () => {
  it('preset: corta pelo mês do cutoff e desliga com rangeMonths null', () => {
    filters.rangeMonths = 6 // cutoff = 15/04/2026 → abril é o primeiro mês válido
    expect(inPeriodMonth('2026-04')).toBe(true)
    expect(inPeriodMonth('2026-03')).toBe(false)
    expect(inPeriodMonth('2026-10')).toBe(true)
    filters.rangeMonths = null
    expect(inPeriodMonth('2019-01')).toBe(true)
  })

  it('semana pertence ao mês da sua segunda-feira (corte mensal vale p/ vistas semanais)', () => {
    filters.rangeMonths = 6
    expect(inPeriodMonth('2026-W14')).toBe(false) // seg 30/03/2026 → março
    expect(inPeriodMonth('2026-W15')).toBe(true) // seg 06/04/2026 → abril
    expect(inPeriodMonth('2026-W06')).toBe(false) // seg 02/02/2026 → fevereiro
  })

  it('range customizado: meses por mês; semanas por INTERSECTAR (buckets inteiros)', () => {
    filters.dateFrom = '2026-02-01'
    filters.dateTo = '2026-05-31'
    expect(inPeriodMonth('2026-01')).toBe(false)
    expect(inPeriodMonth('2026-02')).toBe(true)
    expect(inPeriodMonth('2026-05')).toBe(true)
    expect(inPeriodMonth('2026-06')).toBe(false)
    // semana entra se [seg..dom] intersectar [from..to] — nunca pela metade
    expect(inPeriodMonth('2026-W05')).toBe(true) // seg 26/01..dom 01/02 — encosta no from
    expect(inPeriodMonth('2026-W06')).toBe(true) // seg 02/02..dom 08/02
    expect(inPeriodMonth('2026-W22')).toBe(true) // seg 25/05..dom 31/05 — encosta no to
    expect(inPeriodMonth('2026-W04')).toBe(false) // seg 19/01..dom 25/01 — termina antes
    expect(inPeriodMonth('2026-W23')).toBe(false) // seg 01/06..dom 07/06 — começa depois
  })

  it('atalho "esta semana" é exato: só a semana atual entra (mês continua por mês)', () => {
    const w = quickRange('thisWeek', new Date(Date.UTC(2026, 9, 30))) // 2026-W44
    filters.dateFrom = w.from
    filters.dateTo = w.to
    expect(inPeriodMonth('2026-W44')).toBe(true)
    expect(inPeriodMonth('2026-W43')).toBe(false)
    expect(inPeriodMonth('2026-W45')).toBe(false)
    expect(inPeriodMonth('2026-10')).toBe(true)
    expect(inPeriodMonth('2026-11')).toBe(true) // novembro tem 1 dia da janela
    expect(inPeriodMonth('2026-09')).toBe(false)
  })
})

describe('inPeriodDay', () => {
  it('null fica sempre fora; cortes por dia nas pontas do range customizado', () => {
    filters.dateFrom = '2026-04-01'
    filters.dateTo = '2026-04-30'
    expect(inPeriodDay(null)).toBe(false)
    expect(inPeriodDay('2026-03-15T12:00:00.000Z')).toBe(false) // antes do from
    expect(inPeriodDay('2026-04-15T12:00:00.000Z')).toBe(true) // dentro
    expect(inPeriodDay('2026-05-05T12:00:00.000Z')).toBe(false) // depois do to
  })

  it('sem range customizado o corte é o cutoff do preset', () => {
    filters.rangeMonths = 12 // cutoff = 15/10/2025
    expect(inPeriodDay('2025-01-15T12:00:00.000Z')).toBe(false)
    expect(inPeriodDay('2026-01-15T12:00:00.000Z')).toBe(true)
  })
})
