import { ref, watch } from 'vue'
import { filters, stats } from './data'

/**
 * Sincroniza o estado do DASHBOARD (aba ativa + filtros) com a query string da
 * URL — links ficam compartilháveis/bookmarkáveis.
 *
 * Formato: ?tab=team&range=6&bots=1&repos=en-admin,en-space&devs=Ana150
 * Valores default são omitidos para manter a URL limpa.
 * Usa replaceState (não polui o histórico a cada clique em filtro).
 * Só atua na rota raiz — a página do dev (/dev/:nome) tem estado próprio.
 */

export const activeTab = ref('overview')
const TABS = ['overview', 'team', 'health', 'repos', 'prs']
const RANGES = [1, 3, 6, 12, 24]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function onDashboard(): boolean {
  return location.pathname === '/' || location.pathname === '/index.html'
}

function parseUrl(reset = false) {
  // no popstate, volta tudo aos defaults antes de aplicar o que houver na URL
  if (reset) {
    activeTab.value = 'overview'
    filters.rangeMonths = 12
    filters.dateFrom = null
    filters.dateTo = null
    filters.showBots = false
    filters.repos = []
    filters.authors = []
  }

  const q = new URLSearchParams(location.search)

  const tab = q.get('tab')
  if (tab && TABS.includes(tab)) activeTab.value = tab

  const from = q.get('from')
  const to = q.get('to')
  if (from && DATE_RE.test(from)) filters.dateFrom = from
  if (to && DATE_RE.test(to)) filters.dateTo = to

  // range só se aplica quando não há range customizado na URL
  const range = q.get('range')
  if (!filters.dateFrom && !filters.dateTo) {
    if (range === 'all') filters.rangeMonths = null
    else if (range && RANGES.includes(Number(range))) filters.rangeMonths = Number(range)
  }

  if (q.has('bots')) filters.showBots = q.get('bots') === '1'

  const repos = q.get('repos')
  if (repos) filters.repos = repos.split(',').filter(Boolean)

  const devs = q.get('devs')
  if (devs) filters.authors = devs.split(',').filter(Boolean)
}

function buildUrl(): string {
  const q = new URLSearchParams()
  if (activeTab.value !== 'overview') q.set('tab', activeTab.value)
  if (filters.dateFrom || filters.dateTo) {
    if (filters.dateFrom) q.set('from', filters.dateFrom)
    if (filters.dateTo) q.set('to', filters.dateTo)
  }
  else if (filters.rangeMonths !== 12) q.set('range', filters.rangeMonths == null ? 'all' : String(filters.rangeMonths))
  if (filters.showBots) q.set('bots', '1')
  if (filters.repos.length) q.set('repos', filters.repos.join(','))
  if (filters.authors.length) q.set('devs', filters.authors.join(','))
  const s = q.toString()
  return s ? `${location.pathname}?${s}` : location.pathname
}

/** remove valores da URL que não existem nos dados (ex.: repo renomeado) */
function sanitize() {
  const s = stats.value
  if (!s) return
  const repos = new Set(s.repos)
  const authors = new Set(s.authors.map(a => a.name))
  filters.repos = filters.repos.filter(r => repos.has(r))
  filters.authors = filters.authors.filter(a => authors.has(a))
}

let initialized = false
export function initUrlState() {
  if (initialized) return
  initialized = true

  // URL tem prioridade; sem parâmetros, cai no localStorage (aba) / defaults (filtros)
  activeTab.value = localStorage.getItem('gitview:tab') ?? 'overview'
  if (onDashboard()) {
    parseUrl()
    sanitize()
  }

  watch(stats, sanitize)

  watch([filters, activeTab], () => {
    if (!onDashboard()) return // não pisa na rota do dev
    history.replaceState(null, '', buildUrl())
    localStorage.setItem('gitview:tab', activeTab.value)
  }, { deep: true })

  window.addEventListener('popstate', () => {
    if (!onDashboard()) return
    parseUrl(true)
    sanitize()
  })
}

/** regrava a query string no estado atual (ex.: ao voltar da página do dev) */
export function syncUrlNow() {
  if (!onDashboard()) return
  history.replaceState(null, '', buildUrl())
}
