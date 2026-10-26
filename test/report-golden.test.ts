import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daily } from '../src/daily'
import { stats } from '../src/data'
import { setFormatLocale } from '../src/format'
import { github } from '../src/github'
import { getComposerIfReady } from '../src/i18n'
import { releases } from '../src/releases'
import { buildReport, rollingWindow } from '../src/report'
import { buildWeeklySummary } from '../src/summary'
import { team } from '../src/team'
import defaultGolden from './fixtures/report-default-6009b4f.json'
import {
  REPORT_GOLDEN_NOW,
  REPORT_GOLDEN_TIMEZONE,
  seedReportGoldenFixture,
} from './fixtures/report-golden'
import weeklyGolden from './fixtures/report-weekly-6009b4f.json'

beforeEach(() => {
  vi.useFakeTimers({ now: REPORT_GOLDEN_NOW })
  seedReportGoldenFixture()
})

afterEach(() => {
  vi.useRealTimers()
  setFormatLocale('pt-BR')
  stats.value = null
  github.value = null
  releases.value = null
  team.value = null
  daily.value = null
})

describe('goldens independentes da base 6009b4f', () => {
  it('org × 7d com people OFF preserva title/from/to/markdown completos', () => {
    expect(new Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(REPORT_GOLDEN_TIMEZONE)
    expect(getComposerIfReady()).toBeNull()
    const window = rollingWindow(7, REPORT_GOLDEN_NOW)
    const report = buildReport({ kind: 'org' }, window.from, window.to, window.inProgress)
    expect(report).not.toBeNull()
    expect(JSON.parse(JSON.stringify(report))).toEqual(defaultGolden)
    expect(Object.keys(defaultGolden).sort()).toEqual(['from', 'markdown', 'title', 'to'])
    expect(defaultGolden.markdown).toContain('## Atenção')
    expect(defaultGolden.markdown).toContain('repos sem commit')
    expect(defaultGolden.markdown).not.toContain('fora do horário')
    expect(defaultGolden.markdown).not.toContain('devs sem commit')
    expect(defaultGolden.markdown).not.toContain('métricas de pessoas')
  })

  it('resumo semanal com people ON preserva from/to/weekKey/markdown completos', () => {
    expect(new Date().toISOString()).toBe(REPORT_GOLDEN_NOW.toISOString())
    const weekly = buildWeeklySummary()
    expect(weekly).not.toBeNull()
    expect(JSON.parse(JSON.stringify(weekly))).toEqual(weeklyGolden)
    expect(Object.keys(weeklyGolden).sort()).toEqual(['from', 'markdown', 'to', 'weekKey'])
    expect(weeklyGolden.weekKey).toBe('2026-W41')
    expect(weeklyGolden.markdown).toContain('fora do horário')
    expect(weeklyGolden.markdown).toContain('devs sem commit')
    expect(weeklyGolden.markdown).toContain('métricas de pessoas')
  })
})
