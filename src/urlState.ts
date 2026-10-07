import { ref, watch } from 'vue'
import { filters, selectedDev, stats } from './data'

/**
 * Sincroniza o estado da UI (aba ativa + filtros + dev em detalhe) com a query
 * string da URL — links ficam compartilháveis/bookmarkáveis.
 *
 * Formato: ?tab=team&range=6&bots=1&repos=en-admin,example&devs=Dev A&dev=Raul+Domingues
 * Valores default são omitidos para manter a URL limpa.
 * Usa replaceState (não polui o histórico a cada clique em filtro).
 */

export const activeTab = ref('overview')
const TABS = ['overview', 'team', 'health', 'repos', 'prs']
const RANGES = [3, 6, 12]

function parseUrl(reset = false) {
  // no popstate, volta tudo aos defaults antes de aplicar o que houver na URL
  if (reset) {
    activeTab.value = 'overview'
    filters.rangeMonths = 12
    filters.showBots = false
    filters.repos = []
    filters.authors = []
    selectedDev.value = null
  }

  const q = new URLSearchParams(location.search)

  const tab = q.get('tab')
  if (tab && TABS.includes(tab)) activeTab.value = tab

  const range = q.get('range')
  if (range === 'all') filters.rangeMonths = null
  else if (range && RANGES.includes(Number(range))) filters.rangeMonths = Number(range)

  if (q.has('bots')) filters.showBots = q.get('bots') === '1'

  const repos = q.get('repos')
  if (repos) filters.repos = repos.split(',').filter(Boolean)

  const devs = q.get('devs')
  if (devs) filters.authors = devs.split(',').filter(Boolean)

  selectedDev.value = q.get('dev')
}

function buildUrl(): string {
  const q = new URLSearchParams()
  if (activeTab.value !== 'overview') q.set('tab', activeTab.value)
  if (filters.rangeMonths !== 12) q.set('range', filters.rangeMonths == null ? 'all' : String(filters.rangeMonths))
  if (filters.showBots) q.set('bots', '1')
  if (filters.repos.length) q.set('repos', filters.repos.join(','))
  if (filters.authors.length) q.set('devs', filters.authors.join(','))
  if (selectedDev.value) q.set('dev', selectedDev.value)
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
  if (selectedDev.value && !authors.has(selectedDev.value)) selectedDev.value = null
}

let initialized = false
export function initUrlState() {
  if (initialized) return
  initialized = true

  // URL tem prioridade; sem parâmetros, cai no localStorage (aba) / defaults (filtros)
  activeTab.value = localStorage.getItem('gitview:tab') ?? 'overview'
  parseUrl()
  sanitize()

  watch(stats, sanitize)

  watch([filters, activeTab, selectedDev], () => {
    history.replaceState(null, '', buildUrl())
    localStorage.setItem('gitview:tab', activeTab.value)
  }, { deep: true })

  window.addEventListener('popstate', () => {
    parseUrl(true)
    sanitize()
  })
}
