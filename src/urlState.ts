import type { RouteLocationNormalized } from 'vue-router'
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { filters, stats } from './data'

/**
 * Sincroniza os filtros com a query string da URL — links ficam
 * compartilháveis/bookmarkáveis.
 *
 * Formato: ?range=6&from=2026-01-01&to=2026-06-30&bots=1&repos=example&devs=Dev A
 * Valores default são omitidos para manter a URL limpa.
 * Usa replaceState (não polui o histórico a cada clique em filtro).
 *
 * Escopo por rota = route.meta.filters (definido por página em src/pages):
 * - 'full' (dashboard e seções com dados agregados): período + repos + devs + bots
 * - 'team' (/teams/:name): período + repos — os devs NÃO vão pra URL nem pra
 *   sidebar: a página trava filters.authors nos membros do time (fonte = team.json)
 * - 'period' (/devs/:name): só o período
 * - 'period-bots' (/repos/:name): período + bots
 * - 'none' (/setup, /settings, 404...): urlState não atua
 * As abas do dashboard são rotas próprias desde 0.33 — o ?tab= legado é tratado
 * pelo guard (router/guards.ts), não aqui.
 */

type FilterScope = 'full' | 'team' | 'period' | 'period-bots' | 'none'
const RANGES = [1, 3, 6, 12, 24]
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function scopeOf(route: RouteLocationNormalized | null): FilterScope {
  return (route?.meta?.filters as FilterScope | undefined) ?? 'none'
}

/** período (range/from/to) + bots — vale em todo escopo de dados */
function applyRangeParams(q: URLSearchParams, scope: FilterScope) {
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

  if ((scope === 'full' || scope === 'period-bots') && q.has('bots'))
    filters.showBots = q.get('bots') === '1'
}

function parseUrl(scope: FilterScope, reset = false) {
  // no popstate, volta tudo aos defaults antes de aplicar o que houver na URL
  if (reset) {
    filters.rangeMonths = 12
    filters.dateFrom = null
    filters.dateTo = null
    filters.showBots = false
    if (scope === 'full' || scope === 'team')
      filters.repos = []
    if (scope === 'full')
      filters.authors = []
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

  if (scope === 'full' || scope === 'team') {
    const repos = q.get('repos')
    if (repos)
      filters.repos = repos.split(',').filter(Boolean)
  }

  if (scope === 'full') {
    const devs = q.get('devs')
    if (devs)
      filters.authors = devs.split(',').filter(Boolean)
  }

  applyRangeParams(q, scope)
}

function buildUrl(scope: FilterScope): string {
  const q = new URLSearchParams()
  if (scope === 'full' || scope === 'team') {
    if (filters.repos.length)
      q.set('repos', filters.repos.join(','))
  }
  if (scope === 'full' && filters.authors.length)
    q.set('devs', filters.authors.join(','))
  if (filters.dateFrom || filters.dateTo) {
    if (filters.dateFrom)
      q.set('from', filters.dateFrom)
    if (filters.dateTo)
      q.set('to', filters.dateTo)
  }
  else if (filters.rangeMonths !== 12) {
    q.set('range', filters.rangeMonths == null ? 'all' : String(filters.rangeMonths))
  }
  if (filters.showBots && (scope === 'full' || scope === 'period-bots'))
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
  const route = useRoute()

  const initialScope = scopeOf(route)
  if (initialScope !== 'none') {
    parseUrl(initialScope)
    sanitize()
  }

  watch(stats, sanitize)

  watch(filters, () => {
    const scope = scopeOf(route)
    if (scope === 'none')
      return // não pisa em /setup e afins
    history.replaceState(null, '', buildUrl(scope))
    localStorage.setItem('gitview:range', filters.rangeMonths == null ? 'all' : String(filters.rangeMonths))
  }, { deep: true })

  // navegação por link (ex.: clicar num dev/repo): aplica os params presentes na
  // URL SEM resetar o restante (preserva o contexto atual) e regrava a query da
  // nova rota — assim o período escolhido acompanha a navegação entre as páginas
  router.afterEach((to) => {
    const scope = scopeOf(to)
    if (scope === 'none')
      return
    parseUrl(scope)
    history.replaceState(null, '', buildUrl(scope))
  })

  // voltar/avançar: a URL é a fonte da verdade — reseta os params da rota e aplica o que houver
  window.addEventListener('popstate', () => {
    const scope = scopeOf(route)
    if (scope === 'none')
      return
    parseUrl(scope, true)
    sanitize()
  })
}
