/**
 * Mapa de navegação two-pane (estilo Sentry):
 * rail primária (ícones) → seções; painel contextual → sub-itens da seção.
 *
 * `tab` marca sub-itens que apontam pras tabs do dashboard (/?tab=...);
 * `hash` marca âncoras dentro da própria página (scroll suave).
 */
export interface NavSub {
  label: string
  icon?: string
  tab?: string
  hash?: string
}
export interface NavSection {
  key: string
  label: string
  icon: string
  /** rota base da seção (match por prefixo; '/' é exato) */
  to: string
  subs: NavSub[]
  /** painel contextual embute o FilterBar (rotas com dados filtráveis) */
  showFilters?: boolean
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'dashboards',
    label: 'Dashboards',
    icon: 'i-lucide-layout-dashboard',
    to: '/',
    showFilters: true,
    subs: [
      { label: 'Visão geral', icon: 'i-lucide-layout-dashboard', tab: 'overview' },
      { label: 'Equipe', icon: 'i-lucide-users', tab: 'team' },
      { label: 'Saúde', icon: 'i-lucide-heart-pulse', tab: 'health' },
    ],
  },
  {
    key: 'team',
    label: 'Times',
    icon: 'i-lucide-users',
    to: '/team',
    subs: [
      { label: 'Times', icon: 'i-lucide-users-round', hash: 'times' },
      { label: 'Devs', icon: 'i-lucide-user-round', hash: 'devs' },
      { label: 'Sem mapeamento', icon: 'i-lucide-user-round-x', hash: 'sem-mapeamento' },
    ],
  },
  // seções novas: rotas dedicadas (hoje vivem como tabs do dashboard)
  {
    key: 'prs',
    label: 'PRs',
    icon: 'i-lucide-git-pull-request',
    to: '/prs',
    showFilters: true,
    subs: [
      { label: 'Abertos', icon: 'i-lucide-git-pull-request-arrow', hash: 'abertos' },
      { label: 'Cycle time', icon: 'i-lucide-timer', hash: 'cycle-time' },
      { label: 'Reviews', icon: 'i-lucide-message-square-text', hash: 'reviews' },
    ],
  },
  {
    key: 'repos',
    label: 'Repos',
    icon: 'i-lucide-git-branch',
    to: '/repos',
    showFilters: true,
    subs: [
      { label: 'Tabela', icon: 'i-lucide-table', hash: 'tabela' },
      { label: 'Linhas +/−', icon: 'i-lucide-diff', hash: 'linhas' },
      { label: 'Distribuição', icon: 'i-lucide-chart-pie', hash: 'distribuicao' },
      { label: 'Por mês', icon: 'i-lucide-calendar-days', hash: 'por-mes' },
      { label: 'Tipos de commit', icon: 'i-lucide-tag', hash: 'tipos' },
    ],
  },
  {
    key: 'releases',
    label: 'Releases',
    icon: 'i-lucide-tag',
    to: '/releases',
    subs: [],
  },
]

/** compat: links antigos ?tab=prs|repos → novas rotas dedicadas */
export const LEGACY_TAB_ROUTES: Record<string, string> = {
  prs: '/prs',
  repos: '/repos',
}

/** config/onboarding — isolada no rodapé da rail (padrão Sentry) */
export const NAV_BOTTOM: NavSection = {
  key: 'setup',
  label: 'Config',
  icon: 'i-lucide-settings',
  to: '/setup',
  subs: [],
}

/** resolve a seção ativa a partir do path ('/' exato; demais por prefixo) */
export function sectionFor(path: string): NavSection | undefined {
  if (path === '/' || path === '/index.html')
    return NAV_SECTIONS[0]
  for (const s of [...NAV_SECTIONS.slice(1), NAV_BOTTOM]) {
    if (path.startsWith(s.to))
      return s
  }
  // /dev/:name e /repo/:name pertencem ao contexto de dashboards (filtros)
  if (path.startsWith('/dev/') || path.startsWith('/repo/'))
    return NAV_SECTIONS[0]
  return undefined
}
