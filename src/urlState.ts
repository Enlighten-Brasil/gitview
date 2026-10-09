import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { filters, stats } from './data'
import { LEGACY_TAB_ROUTES } from './nav'

/**
 * Sincroniza o estado (aba + filtros) com a query string da URL — links ficam
 * compartilháveis/bookmarkáveis.
 *
 * Formato: ?tab=team&range=6&bots=1&repos=en-admin,en-space&devs=Ana150
 * Valores default são omitidos para manter a URL limpa.
 * Usa replaceState (não polui o histórico a cada clique em filtro).
 *
 * Escopo por rota:
 * - dashboard (/): tab, repos, devs, período (range/from/to), bots
 * - /dev/:name e /repo/:name: só o período (range/from/to) e bots
 * - demais rotas (/setup etc.): urlState não atua
 */

export const activeTab = ref('overview')
// prs/repos viraram rotas dedicadas (/?tab=prs|repos redireciona via nav.ts)
const TABS = ['overview', 'team', 'health']
const RANGES = [1, 3, 6, 12, 24]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type RouteKind = 'dashboard' | 'dev' | 'repo' | 'other'

function routeKind(path: string): RouteKind {
  if (path === '/' || path === '/index.html')
    return 'dashboard'
  if (path.startsWith('/dev/'))
    return 'dev'
  if (path.startsWith('/repo/'))
    return 'repo'
  return 'other'
}

/** período (range/from/to) + bots — vale no dashboard, /dev e /repo */
function applyRangeParams(q: URLSearchParams) {
  const from = q.get('from')
  const to = q.get('to')
  if (from && DATE_RE.test(from))
    filters.dateFrom = from
  if (to && DATE_RE.test(to))
    filters.dateTo = to

  // range só se aplica quando não há range customizado na URL
  const range = q.get('range')
  if (!filters.dateFrom && !filters.dateTo) {
    if (range === 'all')
      filters.rangeMonths = null
    else if (range && RANGES.includes(Number(range)))
      filters.rangeMonths = Number(range)
  }

  if (q.has('bots'))
    filters.showBots = q.get('bots') === '1'
}

function parseUrl(kind: RouteKind, reset = false) {
  // no popstate, volta tudo aos defaults antes de aplicar o que houver na URL
  if (reset) {
    filters.rangeMonths = 12
    filters.dateFrom = null
    filters.dateTo = null
    filters.showBots = false
    if (kind === 'dashboard') {
      activeTab.value = 'overview'
      filters.repos = []
      filters.authors = []
    }
  }

  const q = new URLSearchParams(location.search)

  // sem parâmetros de período na URL → cai no último range usado (persistido)
  if (!reset && !q.has('range') && !q.has('from') && !q.has('to')) {
    const savedRange = localStorage.getItem('gitview:range')
    if (savedRange === 'all')
      filters.rangeMonths = null
    else if (savedRange && RANGES.includes(Number(savedRange)))
      filters.rangeMonths = Number(savedRange)
  }

  if (kind === 'dashboard') {
    const tab = q.get('tab')
    if (tab && TABS.includes(tab))
      activeTab.value = tab

    const repos = q.get('repos')
    if (repos)
      filters.repos = repos.split(',').filter(Boolean)

    const devs = q.get('devs')
    if (devs)
      filters.authors = devs.split(',').filter(Boolean)
  }

  applyRangeParams(q)
}

function buildUrl(kind: RouteKind): string {
  const q = new URLSearchParams()
  if (kind === 'dashboard') {
    if (activeTab.value !== 'overview')
      q.set('tab', activeTab.value)
    if (filters.repos.length)
      q.set('repos', filters.repos.join(','))
    if (filters.authors.length)
      q.set('devs', filters.authors.join(','))
  }
  if (filters.dateFrom || filters.dateTo) {
    if (filters.dateFrom)
      q.set('from', filters.dateFrom)
    if (filters.dateTo)
      q.set('to', filters.dateTo)
  }
  else if (filters.rangeMonths !== 12) {
    q.set('range', filters.rangeMonths == null ? 'all' : String(filters.rangeMonths))
  }
  if (filters.showBots)
    q.set('bots', '1')
  const s = q.toString()
  return s ? `${location.pathname}?${s}` : location.pathname
}

/** remove valores da URL que não existem nos dados (ex.: repo renomeado) */
function sanitize() {
  const s = stats.value
  if (!s)
    return
  const repos = new Set(s.repos)
  const authors = new Set(s.authors.map(a => a.name))
  filters.repos = filters.repos.filter(r => repos.has(r))
  filters.authors = filters.authors.filter(a => authors.has(a))
}

let initialized = false
export function initUrlState() {
  if (initialized)
    return
  initialized = true

  const router = useRouter()

  // compat: ?tab=prs|repos (links antigos) → rotas dedicadas
  const legacyTab = new URLSearchParams(location.search).get('tab')
  if (legacyTab && LEGACY_TAB_ROUTES[legacyTab] && routeKind(location.pathname) === 'dashboard') {
    const q = new URLSearchParams(location.search)
    q.delete('tab')
    const qs = q.toString()
    router.replace({ path: LEGACY_TAB_ROUTES[legacyTab], query: qs ? Object.fromEntries(q) : {} })
  }

  // URL tem prioridade; sem parâmetros, cai no localStorage (aba) / defaults (filtros)
  activeTab.value = localStorage.getItem('gitview:tab') ?? 'overview'
  const initialKind = routeKind(location.pathname)
  if (initialKind !== 'other') {
    parseUrl(initialKind)
    sanitize()
  }

  watch(stats, sanitize)

  watch([filters, activeTab], () => {
    const kind = routeKind(location.pathname)
    if (kind === 'other')
      return // não pisa em /setup e afins
    history.replaceState(null, '', buildUrl(kind))
    localStorage.setItem('gitview:tab', activeTab.value)
    localStorage.setItem('gitview:range', filters.rangeMonths == null ? 'all' : String(filters.rangeMonths))
  }, { deep: true })

  // navegação por link (ex.: clicar num dev/repo): aplica os params presentes na
  // URL SEM resetar o restante (preserva o contexto atual) e regrava a query da
  // nova rota — assim o período escolhido acompanha a navegação entre as páginas
  router.afterEach((to) => {
    const kind = routeKind(to.path)
    if (kind === 'other')
      return
    parseUrl(kind)
    history.replaceState(null, '', buildUrl(kind))
  })

  // voltar/avançar: a URL é a fonte da verdade — reseta os params da rota e aplica o que houver
  window.addEventListener('popstate', () => {
    const kind = routeKind(location.pathname)
    if (kind === 'other')
      return
    parseUrl(kind, true)
    sanitize()
  })
}

/** regrava a query string no estado atual (ex.: ao voltar da página do dev) */
export function syncUrlNow() {
  const kind = routeKind(location.pathname)
  if (kind === 'other')
    return
  history.replaceState(null, '', buildUrl(kind))
}
