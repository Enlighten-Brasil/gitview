import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(new URL('../src/pages/(app)/reports.vue', import.meta.url), 'utf8')
const collect = readFileSync(new URL('../src/collect.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('../src/main.css', import.meta.url), 'utf8')

function functionBody(name: string): string {
  const marker = `function ${name}(`
  const start = page.indexOf(marker)
  expect(start, `função ${name} encontrada`).toBeGreaterThanOrEqual(0)
  const signatureEnd = page.indexOf(') {', start + marker.length)
  expect(signatureEnd, `assinatura ${name} encontrada`).toBeGreaterThan(start)
  const bodyStart = signatureEnd + 3
  const end = page.indexOf('\n}', bodyStart)
  expect(end, `corpo ${name} encontrado`).toBeGreaterThan(bodyStart)
  return page.slice(bodyStart, end)
}

describe('página /reports — integração do anexo', () => {
  it('usa o contrato canônico de query e nunca persiste os dois opt-ins', () => {
    expect(page).toContain('sanitizeReportQuery(route.query)')
    expect(page).toContain('reportQueryOf(')
    expect(page).toContain('reportQueryForStorage(')
    expect(page).not.toContain('const DATE_RE')
    expect(page).not.toContain('people: q.people')
  })

  it('limpa a última query no set mesmo quando os defaults geram um objeto vazio', () => {
    const body = functionBody('set')
    expect(body).toContain('const q = reportQueryOf(next)')
    expect(body).toContain('lastQuery = q')
    expect(body.indexOf('lastQuery = q')).toBeLessThan(body.indexOf('router.replace'))
    // A restauração legítima por preferência neutra e por âncora permanece.
    expect(page).toContain('const saved = savedQuery()')
    expect(page).toContain('query: saved')
    expect(page).toContain('query: lastQuery')
  })

  it('expõe o preset last-month e o conecta ao motor já existente', () => {
    expect(page).toContain('id: \'last-month\'')
    expect(page).toContain('case \'last-month\': return presetWindow(\'last-month\')')
  })

  it('ativa o loader pela query, inclusive no F5, e desativa ao sair', () => {
    expect(page).toContain('state.value.commits')
    expect(page).toContain('setReportCommitsActive(enabled)')
    expect(page).toContain('setReportCommitsActive(false)')
    expect(page).toContain('{ immediate: true }')
    expect(page).toContain('{ people: state.value.people, commits: state.value.commits }')
  })

  it('guarda copiar, download e PDF pela mesma exportReady', () => {
    expect(page).toContain('const exportReady = computed')
    for (const name of ['onCopy', 'onDownload', 'onPdf'])
      expect(functionBody(name), name).toContain('exportReady.value')
    expect(page.match(/:disabled="!exportReady/g)).toHaveLength(3)
  })

  it('exporta PDF nativo pelo markdown do relatório (não pela impressão)', () => {
    expect(page).toContain('usePdfExport')
    expect(page).toContain('exportPdf(report.value.markdown')
    expect(page).not.toContain('window.print()')
    // toasts e o gerador vivem na composable compartilhada
    const composable = readFileSync(new URL('../src/composables/usePdfExport.ts', import.meta.url), 'utf8')
    expect(composable).toContain('buildReportPdf(')
    expect(composable).toContain('reportT(\'report.pdf.done\')')
    expect(composable).toContain('reportT(\'report.pdf.error\')')
  })

  it('resumo semanal exporta o mesmo PDF (composable compartilhada)', () => {
    const summary = readFileSync(new URL('../src/components/WeeklySummary.vue', import.meta.url), 'utf8')
    expect(summary).toContain('usePdfExport')
    expect(summary).toContain('exportPdf(summary.value.markdown')
    expect(summary).toContain('resumo-$' + '{summary.value.weekKey}.pdf')
    expect(summary).toContain('reportT(\'report.pdf.button\')')
  })

  it('recoleta o artefato lazy com cache-bust somente quando ativo', () => {
    expect(collect).toContain('reportCommitsActive.value')
    expect(collect).toContain('loadReportCommits(true)')
  })

  it('estiliza H3 e evita quebrar cada dev/subtotal no meio na impressão', () => {
    expect(css).toContain('.report-md h3')
    expect(css).toMatch(/\.report-md h3[\s\S]*break-after:\s*avoid/)
    expect(css).toMatch(/\.report-md li[\s\S]*break-inside:\s*avoid/)
  })

  it('expõe o estado dos toggles para tecnologia assistiva', () => {
    for (const binding of [
      'viewMode === \'preview\'',
      'viewMode === \'raw\'',
      'state.subject === s.id',
      'state.preset === p.id',
    ])
      expect(page).toContain(`:aria-pressed="${binding}"`)
    // opt-ins de conteúdo são checkboxes nativos (configuração, não ação)
    for (const binding of ['state.commits', 'state.people'])
      expect(page).toContain(`:model-value="${binding}"`)
  })

  it('dá affordance aos links e quebra textos longos no preview e na impressão', () => {
    expect(css).toMatch(/\.report-md\s*\{[^}]*overflow-wrap:\s*anywhere/)
    expect(css).toMatch(/\.report-md a\s*\{[^}]*color:\s*var\(--ui-primary\)/)
    expect(css).toMatch(/\.report-md a\s*\{[^}]*text-decoration:\s*underline/)
  })
})
