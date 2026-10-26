import type { Locale } from '../src/i18n'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daily } from '../src/daily'
import { stats } from '../src/data'
import { fmtDate, fmtDay, setFormatLocale } from '../src/format'
import { github } from '../src/github'
import { getComposerIfReady, loadChunk, setupI18n } from '../src/i18n'
import enReport from '../src/locales/en-US/report.json'
import esReport from '../src/locales/es-ES/report.json'
import ptReport from '../src/locales/pt-BR/report.json'
import { releases } from '../src/releases'
import { buildReport, rollingWindow } from '../src/report'
import { reportPlural, reportT } from '../src/report-i18n'
import { team } from '../src/team'
import {
  REPORT_GOLDEN_NOW,
  seedReportGoldenFixture,
} from './fixtures/report-golden'

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]).sort()
}

function catalogShape(catalog: Record<string, string>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(catalog).map(([key, value]) => [key, placeholders(value)]))
}

function pluralBases(catalog: Record<string, string>, suffix: '.one' | '.other'): string[] {
  return Object.keys(catalog).filter(key => key.endsWith(suffix)).map(key => key.slice(0, -suffix.length)).sort()
}

beforeEach(() => {
  vi.useFakeTimers({ now: REPORT_GOLDEN_NOW })
  seedReportGoldenFixture()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  setFormatLocale('pt-BR')
  stats.value = null
  github.value = null
  releases.value = null
  team.value = null
  daily.value = null
})

describe('report-i18n em Node sem bootstrap', () => {
  it('usa pt-BR direto, interpola e pluraliza sem navigator/localStorage', () => {
    const forbidden = new Proxy({}, {
      get() {
        throw new Error('acesso global proibido no fallback Node')
      },
    })
    vi.stubGlobal('navigator', forbidden)
    vi.stubGlobal('localStorage', forbidden)

    expect(getComposerIfReady()).toBeNull()
    expect(reportT('report.heading.commits')).toBe('## Commits')
    expect(reportT('report.title.default', { subject: '', from: '09/10', to: '15/10/2026' })).toBe('Resumo — 09/10 a 15/10/2026')
    expect(reportPlural('report.commits', 0)).toBe('0 commits')
    expect(reportPlural('report.commits', 1)).toBe('1 commit')
    expect(reportPlural('report.commits', 2)).toBe('2 commits')
    expect(reportPlural('report.window.rolling', 7)).toBe('nos 7 dias')
  })

  it('não importa vue-i18n estaticamente nem esconde erros em catch genérico', () => {
    const source = readFileSync(new URL('../src/report-i18n.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/^import\s.*['"]vue-i18n['"]/m)
    expect(source).not.toMatch(/\bcatch\s*[({]/)
  })
})

describe('catálogos report', () => {
  it('mantêm paridade exata de chaves e placeholders', () => {
    const base = Object.keys(ptReport).sort()
    expect(Object.keys(enReport).sort()).toEqual(base)
    expect(Object.keys(esReport).sort()).toEqual(base)
    expect(catalogShape(enReport)).toEqual(catalogShape(ptReport))
    expect(catalogShape(esReport)).toEqual(catalogShape(ptReport))
  })

  it('todo plural tem exatamente as variantes one/other nos três locales', () => {
    for (const catalog of [ptReport, enReport, esReport]) {
      expect(pluralBases(catalog, '.one')).toEqual(pluralBases(catalog, '.other'))
      expect(pluralBases(catalog, '.one').length).toBeGreaterThan(0)
    }
  })
})

describe('report-i18n com composer ativo', () => {
  it('troca pt-BR/en-US/es-ES e faz smoke estrutural do relatório completo', async () => {
    const i18n = await setupI18n('pt-BR')
    expect(getComposerIfReady()).toBe(i18n.global)
    const window = rollingWindow(7, REPORT_GOLDEN_NOW)
    const cases: Array<[Locale, string, string, string, string, string, string]> = [
      ['pt-BR', 'Resumo', 'a', '1 PR mergeado', '2 PRs mergeados', '1 review', '## Atenção'],
      ['en-US', 'Summary', 'to', '1 merged PR', '2 merged PRs', '1 review', '## Attention'],
      ['es-ES', 'Resumen', 'a', '1 PR fusionado', '2 PRs fusionados', '1 revisión', '## Atención'],
    ]

    for (const [locale, title, range, onePr, manyPrs, oneReview, attention] of cases) {
      await loadChunk(i18n.global, locale)
      i18n.global.locale.value = locale
      setFormatLocale(locale)

      expect(reportPlural('report.prMerged', 1)).toBe(onePr)
      expect(reportPlural('report.prMerged', 2)).toBe(manyPrs)
      expect(reportPlural('report.review', 1)).toBe(oneReview)
      expect(reportPlural('report.review', 2)).not.toBe(oneReview)

      const report = buildReport({ kind: 'org' }, window.from, window.to, window.inProgress)
      expect(report).not.toBeNull()
      if (!report)
        throw new Error('relatório ausente no smoke de locale')
      expect(report.title).toBe(`${title} — ${fmtDay(window.from)} ${range} ${fmtDate(window.to)}`)
      expect(report.markdown).toContain(reportT('report.heading.commits'))
      expect(report.markdown).toContain(reportT('report.heading.prs'))
      expect(report.markdown).toContain(reportT('report.heading.releases'))
      expect(report.markdown).toContain(attention)
      expect(report.markdown).not.toMatch(/\{[a-z][a-z0-9]*\}/i)
      expect(report.markdown).not.toContain('métricas de pessoas')
    }
  })
})
