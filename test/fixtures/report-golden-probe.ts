import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { buildReport, rollingWindow } from '../../src/report'
import { buildWeeklySummary } from '../../src/summary'
import {
  pinReportGoldenDate,
  REPORT_GOLDEN_BASE,
  REPORT_GOLDEN_LOCALE,
  REPORT_GOLDEN_NOW,
  REPORT_GOLDEN_TIMEZONE,
  seedReportGoldenFixture,
} from './report-golden'

const mode = process.argv[2]
assert.ok(mode === '--write' || mode === '--check', 'uso: tsx test/fixtures/report-golden-probe.ts --write|--check')

if (mode === '--write') {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  assert.equal(head, REPORT_GOLDEN_BASE, 'os goldens independentes só podem ser gravados na base 6009b4f')
  const productionStatus = execFileSync('git', ['status', '--porcelain', '--', 'src', 'scripts'], { encoding: 'utf8' }).trim()
  assert.equal(productionStatus, '', 'os goldens independentes exigem src/ e scripts/ sem alterações na base 6009b4f')
}

assert.equal(new Intl.DateTimeFormat().resolvedOptions().timeZone, REPORT_GOLDEN_TIMEZONE)
pinReportGoldenDate()
seedReportGoldenFixture()

const window = rollingWindow(7, REPORT_GOLDEN_NOW)
const defaultReport = buildReport({ kind: 'org' }, window.from, window.to, window.inProgress)
const weeklyReport = buildWeeklySummary()
assert.ok(defaultReport, 'fixture sem relatório org 7d')
assert.ok(weeklyReport, 'fixture sem resumo semanal')
assert.ok(!defaultReport.markdown.includes('métricas de pessoas'), 'org 7d precisa manter people OFF')
assert.ok(weeklyReport.markdown.includes('métricas de pessoas'), 'resumo semanal precisa manter people ON')

const artifacts = [
  ['report-default-6009b4f.json', defaultReport],
  ['report-weekly-6009b4f.json', weeklyReport],
] as const

for (const [filename, result] of artifacts) {
  const url = new URL(`./${filename}`, import.meta.url)
  const actual = `${JSON.stringify(result, null, 2)}\n`
  if (mode === '--write')
    writeFileSync(url, actual, 'utf8')
  else
    assert.equal(actual, readFileSync(url, 'utf8'), `${filename}: saída divergiu do golden da base 6009b4f`)
  const sha256 = createHash('sha256').update(actual).digest('hex')
  process.stdout.write(`✓ ${filename}: ${mode === '--write' ? 'gerado' : 'byte-idêntico'} · sha256 ${sha256}\n`)
}

process.stdout.write(`✓ report-golden: Node sem bootstrap · locale ${REPORT_GOLDEN_LOCALE} · TZ ${REPORT_GOLDEN_TIMEZONE} · clock ${REPORT_GOLDEN_NOW.toISOString()}\n`)
