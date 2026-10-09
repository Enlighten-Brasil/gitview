/**
 * Mapa de navegação two-pane (estilo Sentry):
 * rail primária (ícones) → seções; painel contextual → sub-itens da seção.
 *
 * A seção ativa vem de `route.meta.section` (definida por página em
 * src/pages) — não mais de match por prefixo. Sub-itens:
 * `to` = rota; `hash` = âncora dentro da própria página (scroll suave).
 */
export interface NavSub {
  label: string
  icon?: string
  /** rota (caminho simples) */
  to?: string
  /** âncora dentro da página atual */
  hash?: string
}
export interface NavSection {
  /** bate com route.meta.section */
  key: string
  label: string
  icon: string
  /** rota base da seção na rail */
  to: string
  subs: NavSub[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'dashboards',
    label: 'Dashboards',
    icon: 'i-lucide-layout-dashboard',
    to: '/',
    subs: [
      { label: 'Visão geral', icon: 'i-lucide-layout-dashboard', to: '/' },
      { label: 'Equipe', icon: 'i-lucide-users', to: '/devs' },
      { label: 'Saúde', icon: 'i-lucide-heart-pulse', to: '/health' },
    ],
  },
  {
    key: 'teams',
    label: 'Times',
    icon: 'i-lucide-users',
    to: '/teams',
    subs: [
      { label: 'Times', icon: 'i-lucide-users-round', hash: 'times' },
      { label: 'Devs', icon: 'i-lucide-user-round', hash: 'devs' },
      { label: 'Sem mapeamento', icon: 'i-lucide-user-round-x', hash: 'sem-mapeamento' },
    ],
  },
  {
    key: 'prs',
    label: 'PRs',
    icon: 'i-lucide-git-pull-request',
    to: '/prs',
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
    subs: [
      // leva de volta ao índice quando dentro de /repos/:name
      { label: 'Todos os repositórios', icon: 'i-lucide-list', to: '/repos' },
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

/** config — isolada no rodapé da rail (padrão Sentry); só no dev server */
export const NAV_BOTTOM: NavSection = {
  key: 'settings',
  label: 'Config',
  icon: 'i-lucide-settings',
  to: '/settings',
  subs: [
    { label: 'Geral', icon: 'i-lucide-sliders-horizontal', to: '/settings' },
    { label: 'Repositórios', icon: 'i-lucide-list-checks', to: '/settings/repos' },
    { label: 'Conta GitHub', icon: 'i-lucide-github', to: '/settings/account' },
  ],
}
