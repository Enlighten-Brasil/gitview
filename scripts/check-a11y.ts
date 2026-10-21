/**
 * Gate de acessibilidade (issue #203) — `node:assert` sobre o código-fonte dos
 * componentes (sem DOM). Hoje cobre o rótulo da faixa de alertas da Visão
 * geral: 5 dos 6 alertas ignoram o período, então o rótulo não pode dizer
 * "do período".
 *
 *   pnpm check:a11y
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import process from 'node:process'

const alertStrip = readFileSync(new URL('../src/components/AlertStrip.vue', import.meta.url), 'utf8')
assert.ok(
  alertStrip.includes('aria-label="alertas de saúde do time"'),
  'AlertStrip sem o aria-label novo (alertas de saúde do time)',
)

process.stdout.write('check:a11y ok\n')
