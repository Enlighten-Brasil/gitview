import type { WorkScope } from '../src/filters-core'
import type { Stats } from '../src/types'
/**
 * Harness versionado de regressão das agregações (issue #130 — método do
 * validador da #128): injeta o `public/data/stats.json` real no ref do store
 * (o mesmo ponto de injeção dos loaders), percorre uma matriz de cenários de
 * filtros (bases de período/seleção × eixo workScope) e imprime no stdout um
 * JSON determinístico — chaves ordenadas, SEM timestamp — das métricas que os
 * componentes consomem. Mesma entrada (stats.json + relógio) → mesmos bytes:
 * a saída serve de baseline para byte-compare entre duas versões do código de
 * agregação (rode no base e no branch com o MESMO stats.json e compare).
 *
 * Node/tsx puro — sem vite, sem browser:
 *
 *   pnpm snapshot:metrics > baseline.json
 *   pnpm snapshot:metrics --now=2026-10-01 > baseline.json
 *
 * - O relógio default é o atual: duas execuções seguidas dão saída
 *   byte-idêntica, mas os presets de período (12M) e as janelas fixas
 *   (ritmo/burnout, últimas N semanas) derivam de "hoje". Com
 *   `--now=YYYY-MM-DD` o `Date` global é pinado no meio-dia local do dia e a
 *   saída passa a ser estável entre datas — é o modo recomendado para
 *   baselines guardados. Compare baselines gerados na mesma máquina/fuso
 *   (o `cutoff()` dos presets usa tempo local).
 * - stdout = o JSON do baseline (redirectável); stderr = diagnóstico + o
 *   resultado da identidade `prod + progress == all` por base (violação →
 *   exit 1). A identidade vale para todo campo ADITIVO do snapshot (somas e
 *   contagens das projeções, totais de commits/linhas) — `authors`/`repos`
 *   dos totais são contagens distintas e não somam. Desde a issue #152 o
 *   snapshot inclui a seção `perAuthor` por cenário (contagem de linhas +
 *   somas aditivas da linha integral e dos eixos byScope) e a identidade
 *   ganha a versão POR LINHA de perAuthor (prod + progress == linha integral
 *   em commits/additions/deletions; violação → exit 1).
 * - A saída contém nomes reais de autores/repos dos SEUS dados locais: nunca
 *   commite um baseline gerado sobre dados reais. Para um baseline
 *   compartilhável, gere o fixture sintético (`pnpm exec tsx
 *   scripts/make-demo-data.ts`) e rode sobre ele.
 *
 * Cenários (mutados só pelas ações nomeadas do store — setRange/
 * setCustomRange/setShowBots/setRepos/setAuthors/setWorkScope; nenhuma porta
 * nova): default-12m, range-all, custom-range (janela derivada do stats),
 * bots-on, single-repo e single-dev (nomes lidos do stats.json, nada
 * hardcoded) × workScope all|prod|progress.
 */
import { readFileSync } from 'node:fs'
import process from 'node:process'
import {
  burnout,
  filteredCommitCount,
  filteredHeatmap,
  filteredMonthly,
  filteredTotals,
  filteredTypes,
  filteredWeekly,
  filters,
  offHoursPeriod,
  pace,
  previousTotals,
  setAuthors,
  setCustomRange,
  setRange,
  setRepos,
  setShowBots,
  stats,
} from '../src/data'
// a fachada data.ts ainda não reexporta setWorkScope — importa direto do módulo
import { setWorkScope } from '../src/filters'

const USAGE = `uso: pnpm snapshot:metrics [--now=YYYY-MM-DD]

  --now=YYYY-MM-DD  pina o relógio no meio-dia local do dia (baseline estável
                    entre datas); default = relógio atual
  stdout: JSON determinístico dos cenários (baseline p/ byte-compare)
  stderr: diagnóstico + identidade prod+progress==all (violação → exit 1)`

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const NOW_RE = /^\d{4}-\d{2}-\d{2}$/

function parseNowArg(argv: string[]): number | null {
  let pinned: number | null = null
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      console.error(USAGE)
      process.exit(0)
    }
    if (!arg.startsWith('--now=')) {
      console.error(`✗ snapshot-metrics: argumento desconhecido "${arg}"\n`)
      console.error(USAGE)
      process.exit(1)
    }
    const value = arg.slice('--now='.length)
    if (!NOW_RE.test(value)) {
      console.error(`✗ snapshot-metrics: --now exige YYYY-MM-DD, veio "${value}"`)
      process.exit(1)
    }
    const ms = new Date(`${value}T12:00:00`).getTime()
    if (Number.isNaN(ms)) {
      console.error(`✗ snapshot-metrics: --now="${value}" não é uma data real`)
      process.exit(1)
    }
    pinned = ms
  }
  return pinned
}

/**
 * Pina o relógio global: `new Date()` sem argumentos e `Date.now()` devolvem
 * o instante fixo; construções com argumentos (string, ms, y/m/d, cópia de
 * outro Date) seguem o comportamento real — é tudo o que `cutoff()` e
 * `lastNWeekKeys()` precisam para o snapshot não depender do dia da execução.
 */
function pinDate(ms: number): void {
  const RealDate = globalThis.Date
  class PinnedDate extends RealDate {
    constructor(...args: never[]) {
      if (args.length === 0) {
        super(ms)
      }
      else {
        // @ts-expect-error repassa os argumentos originais do construtor Date
        super(...args)
      }
    }

    static now(): number {
      return ms
    }
  }
  globalThis.Date = PinnedDate as unknown as DateConstructor
}

// ---------------------------------------------------------------------------
// entrada: stats.json real, injetado no ref do store (padrão dos loaders)
// ---------------------------------------------------------------------------
function loadStats(): Stats {
  const url = new URL('../public/data/stats.json', import.meta.url)
  let raw: string
  try {
    raw = readFileSync(url, 'utf8')
  }
  catch {
    console.error('✗ snapshot-metrics: public/data/stats.json não encontrado — rode "pnpm collect" primeiro')
    process.exit(1)
  }
  const parsed = JSON.parse(raw) as Stats
  if (!parsed.totals || !Array.isArray(parsed.monthly) || parsed.monthly.length === 0) {
    console.error('✗ snapshot-metrics: stats.json sem shape de Stats (totals/monthly ausentes)')
    process.exit(1)
  }
  return parsed
}

// ---------------------------------------------------------------------------
// matriz de cenários
// ---------------------------------------------------------------------------
const WORK_SCOPE_AXIS: WorkScope[] = ['all', 'prod', 'progress']

interface Scenario {
  name: string
  filters: Record<string, unknown>
  metrics: Record<string, unknown>
}

/** estado limpo entre cenários — só ações nomeadas do store */
function resetFilters(): void {
  setRange(12) // limpa dateFrom/dateTo junto
  setShowBots(false)
  setRepos([])
  setAuthors([])
  setWorkScope('all')
}

/** soma campos numéricos de linhas já filtradas (+ contagem) — determinístico */
function sums<T extends object>(rows: readonly T[], fields: (keyof T & string)[]): Record<string, number> {
  const out: Record<string, number> = { count: rows.length }
  for (const field of fields) {
    let total = 0
    for (const row of rows) {
      const value = row[field]
      if (typeof value === 'number')
        total += value
    }
    out[field] = total
  }
  return out
}

/**
 * perAuthor entra na matriz (issue #152): contagem de linhas + somas aditivas
 * (commits/additions/deletions) da linha integral E dos dois eixos byScope.
 * perAuthor ignora os filtros da sidebar (histórico completo), então a seção é
 * idêntica entre os cenários — entra no baseline para o byte-compare pegar
 * regressão na agregação do coletor. Linha sem byScope (dado anterior à
 * feature) contribui só para a parte integral.
 */
function perAuthorSums(rows: Stats['perAuthor']): Record<string, unknown> {
  const out = {
    count: rows.length,
    byScopeRows: 0,
    commits: 0,
    additions: 0,
    deletions: 0,
    prod: { commits: 0, additions: 0, deletions: 0 },
    progress: { commits: 0, additions: 0, deletions: 0 },
  }
  for (const row of rows) {
    out.commits += row.commits
    out.additions += row.additions
    out.deletions += row.deletions
    if (!row.byScope)
      continue
    out.byScopeRows++
    for (const axis of ['prod', 'progress'] as const) {
      out[axis].commits += row.byScope[axis].commits
      out[axis].additions += row.byScope[axis].additions
      out[axis].deletions += row.byScope[axis].deletions
    }
  }
  return out
}

/** o snapshot de um cenário: tudo o que os componentes leem do store filtrado */
function snapshotMetrics(): Record<string, unknown> {
  return {
    filteredTotals: filteredTotals.value,
    filteredCommitCount: filteredCommitCount.value,
    previousTotals: previousTotals.value,
    pace: pace.value,
    burnout: burnout.value,
    offHoursPeriod: offHoursPeriod.value,
    projections: {
      filteredWeekly: sums(filteredWeekly.value, ['commits', 'weekend', 'night']),
      filteredMonthly: sums(filteredMonthly.value, ['commits', 'additions', 'deletions']),
      filteredHeatmap: sums(filteredHeatmap.value, ['commits']),
      filteredTypes: sums(filteredTypes.value, ['commits']),
    },
    perAuthor: perAuthorSums(stats.value?.perAuthor ?? []),
  }
}

function snapshotFilters(): Record<string, unknown> {
  return {
    rangeMonths: filters.rangeMonths,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    showBots: filters.showBots,
    workScope: filters.workScope,
    repos: [...filters.repos],
    authors: [...filters.authors],
  }
}

// ---------------------------------------------------------------------------
// identidade prod + progress == all (campos aditivos do snapshot)
// ---------------------------------------------------------------------------
/** extrai os campos ADITIVOS de um snapshot (autores/repos dos totais ficam fora) */
function additiveFields(metrics: Record<string, unknown>): Record<string, number | null> {
  const totals = metrics.filteredTotals as Record<string, number>
  const prev = metrics.previousTotals as Record<string, number> | null
  const projections = metrics.projections as Record<string, Record<string, number>>
  const out: Record<string, number | null> = {
    'filteredCommitCount': metrics.filteredCommitCount as number,
    'filteredTotals.commits': totals.commits,
    'filteredTotals.additions': totals.additions,
    'filteredTotals.deletions': totals.deletions,
    'previousTotals.commits': prev ? prev.commits : null,
    'previousTotals.additions': prev ? prev.additions : null,
    'previousTotals.deletions': prev ? prev.deletions : null,
  }
  for (const [projection, fields] of Object.entries(projections)) {
    for (const [field, value] of Object.entries(fields))
      out[`projections.${projection}.${field}`] = value
  }
  return out
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const pinned = parseNowArg(process.argv.slice(2))
if (pinned !== null)
  pinDate(pinned)

const data = loadStats()
stats.value = data

// derivações determinísticas do próprio stats.json (nada de nome hardcoded)
const repos = [...data.repos].sort()
const devs = data.authors.filter(a => !a.bot).map(a => a.name).sort()
const months = [...new Set(data.monthly.map(r => r.month))].sort()
if (repos.length === 0 || devs.length === 0 || months.length === 0) {
  console.error('✗ snapshot-metrics: stats.json sem repos/autores/meses — nada para cenarizar')
  process.exit(1)
}
// janela customizada fixa: os 6 primeiros meses do histórico (exercita o
// caminho dateFrom/dateTo; previousTotals = null como no app)
const customFrom = `${months[0]}-01`
const customTo = `${months[Math.min(5, months.length - 1)]}-01`

const bases: { name: string, apply: () => void }[] = [
  { name: 'default-12m', apply: () => {} },
  { name: 'range-all', apply: () => setRange(null) },
  { name: 'custom-range', apply: () => setCustomRange(customFrom, customTo) },
  { name: 'bots-on', apply: () => setShowBots(true) },
  { name: 'single-repo', apply: () => setRepos([repos[0]]) },
  { name: 'single-dev', apply: () => setAuthors([devs[0]]) },
]

const scenarios: Scenario[] = []
for (const base of bases) {
  for (const scope of WORK_SCOPE_AXIS) {
    resetFilters()
    base.apply()
    setWorkScope(scope)
    scenarios.push({
      name: `${base.name}/${scope}`,
      filters: snapshotFilters(),
      metrics: snapshotMetrics(),
    })
  }
}

// identidade prod+progress==all por base, sobre os campos aditivos
const violations: string[] = []
let checkedFields = 0
for (const base of bases) {
  const byName = new Map(scenarios.filter(s => s.name.startsWith(`${base.name}/`)).map(s => [s.name, s.metrics]))
  const all = additiveFields(byName.get(`${base.name}/all`)!)
  const prod = additiveFields(byName.get(`${base.name}/prod`)!)
  const progress = additiveFields(byName.get(`${base.name}/progress`)!)
  for (const field of Object.keys(all)) {
    const [a, p, g] = [all[field], prod[field], progress[field]]
    if (a === null || p === null || g === null) {
      // null (sem janela comparável) tem que coincidir nos três
      if (!(a === p && p === g))
        violations.push(`${base.name}/${field}: nulidade divergente (all=${a}, prod=${p}, progress=${g})`)
      continue
    }
    checkedFields++
    if (p + g !== a)
      violations.push(`${base.name}/${field}: prod(${p}) + progress(${g}) != all(${a})`)
  }
}

// identidade POR LINHA de perAuthor (issue #152): perAuthor ignora os filtros
// (histórico completo), então o prod+progress==all dele não é por cenário — é
// os eixos byScope fechando com a linha integral nos campos aditivos. Linha
// sem byScope (dado anterior à feature) fica fora. Violação → exit 1 abaixo.
let checkedPerAuthorFields = 0
let perAuthorByScopeRows = 0
for (const row of data.perAuthor) {
  if (!row.byScope)
    continue
  perAuthorByScopeRows++
  for (const field of ['commits', 'additions', 'deletions'] as const) {
    checkedPerAuthorFields++
    const p = row.byScope.prod[field]
    const g = row.byScope.progress[field]
    if (p + g !== row[field])
      violations.push(`perAuthor["${row.author}"].${field}: prod(${p}) + progress(${g}) != linha(${row[field]})`)
  }
}

// saída: stdout = baseline JSON (chaves ordenadas, sem timestamp)
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(sortKeys)
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort())
      out[key] = sortKeys(source[key])
    return out
  }
  return value
}

console.log(JSON.stringify(sortKeys({
  scenarios,
  stats: {
    commits: data.totals.commits,
    prodCommits: data.totals.prodCommits,
    progressCommits: data.totals.progressCommits,
    repos: data.repos.length,
    authors: data.authors.length,
  },
}), null, 2))

// diagnóstico: stderr (não polui o baseline redirectado)
const clock = pinned === null ? 'atual' : `pinado --now (${new Date(pinned).toISOString().slice(0, 10)})`
console.error(`snapshot-metrics: ${scenarios.length} cenários (${bases.length} bases × ${WORK_SCOPE_AXIS.length} workScopes) · relógio: ${clock}`)
console.error(`stats.json: ${data.totals.commits} commits (${data.totals.prodCommits} prod + ${data.totals.progressCommits} progress), ${data.repos.length} repos, ${data.authors.length} autores`)
console.error(`perAuthor: ${data.perAuthor.length} linhas, ${perAuthorByScopeRows} com byScope (linhas sem byScope = dado coletado antes da issue #152)`)
if (violations.length > 0) {
  console.error(`✗ identidade prod+progress==all: ${violations.length} violação(ões) em ${checkedFields} comparações de cenário + ${checkedPerAuthorFields} por linha de perAuthor:`)
  for (const v of violations)
    console.error(`  - ${v}`)
  process.exit(1)
}
console.error(`✓ identidade prod+progress==all: ${bases.length} bases × campos aditivos (${checkedFields} comparações) + ${checkedPerAuthorFields} por linha de perAuthor, 0 violações`)
