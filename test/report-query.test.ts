import { describe, expect, it } from 'vitest'
import { reportQueryForStorage, reportQueryOf, sanitizeReportQuery } from '../src/report-query'

describe('query de /reports', () => {
  it('mantém os opt-ins OFF por padrão e omite defaults no round-trip', () => {
    const state = sanitizeReportQuery({})

    expect(state).toMatchObject({ subject: 'org', preset: '7d', people: false, commits: false })
    expect(reportQueryOf(state)).toEqual({})
  })

  it('aceita somente a string 1 e trata arrays/repetições como OFF', () => {
    expect(sanitizeReportQuery({ people: '1', commits: '1' })).toMatchObject({ people: true, commits: true })
    for (const value of ['true', '0', 1, ['1'], ['1', '1'], null]) {
      expect(sanitizeReportQuery({ people: value, commits: value })).toMatchObject({ people: false, commits: false })
    }
  })

  it('preserva people e commits independentemente no F5/compartilhamento', () => {
    const onlyCommits = sanitizeReportQuery({ commits: '1', preset: 'last-month' })
    const onlyPeople = sanitizeReportQuery({ people: '1', preset: 'last-month' })

    expect(reportQueryOf(onlyCommits)).toEqual({ preset: 'last-month', commits: '1' })
    expect(reportQueryOf(onlyPeople)).toEqual({ preset: 'last-month', people: '1' })
    expect(sanitizeReportQuery(reportQueryOf(onlyCommits))).toEqual(onlyCommits)
    expect(sanitizeReportQuery(reportQueryOf(onlyPeople))).toEqual(onlyPeople)
  })

  it('nunca restaura os opt-ins pelo localStorage, sem apagar a janela lembrada', () => {
    const state = sanitizeReportQuery({ subject: 'dev', dev: 'Ana', preset: 'last-month', people: '1', commits: '1' })

    expect(reportQueryForStorage(state)).toEqual({ subject: 'dev', dev: 'Ana', preset: 'last-month' })
    expect(sanitizeReportQuery(reportQueryForStorage(state))).toMatchObject({
      subject: 'dev',
      dev: 'Ana',
      preset: 'last-month',
      people: false,
      commits: false,
    })
  })

  it('faz round-trip do preset existente last-month sem alias', () => {
    const state = sanitizeReportQuery({ preset: 'last-month' })

    expect(state.preset).toBe('last-month')
    expect(reportQueryOf(state)).toEqual({ preset: 'last-month' })
    expect(reportQueryOf(state)).not.toHaveProperty('month-closed')
  })

  it('sanitiza assunto, preset, campos fora do assunto e janelas custom inválidas', () => {
    expect(sanitizeReportQuery({ subject: ['dev', 'team'], preset: ['7d', '30d'] })).toMatchObject({ subject: 'org', preset: '7d' })
    expect(sanitizeReportQuery({ preset: 'month-closed' }).preset).toBe('7d')
    expect(reportQueryOf(sanitizeReportQuery({ subject: 'org', team: 'Time', dev: 'Ana' }))).toEqual({})

    for (const query of [
      { preset: 'custom', from: '2026-02-30', to: '2026-03-02' },
      { preset: 'custom', from: '2026-03-03', to: '2026-03-02' },
      { preset: 'custom', from: ['2026-03-01'], to: '2026-03-02' },
      { preset: 'custom', from: '2026-03-01' },
    ]) {
      expect(sanitizeReportQuery(query).preset).toBe('7d')
    }
  })

  it('mantém uma janela custom válida e remove from/to fora dela', () => {
    const custom = sanitizeReportQuery({ preset: 'custom', from: '2024-02-01', to: '2024-02-29', commits: '1' })
    const preset = sanitizeReportQuery({ preset: '30d', from: '2024-02-01', to: '2024-02-29' })

    expect(custom.preset).toBe('custom')
    expect(reportQueryOf(custom)).toEqual({ preset: 'custom', from: '2024-02-01', to: '2024-02-29', commits: '1' })
    expect(reportQueryOf(preset)).toEqual({ preset: '30d' })
  })
})
