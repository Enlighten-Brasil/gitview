/**
 * Mapa de navegação two-pane (estilo Sentry):
 * rail primária (ícones) → seções; painel contextual → sub-itens da seção.
 *
 * A seção ativa vem de `route.meta.section` (definida por página em
 * src/pages) — não mais de match por prefixo. Sub-itens:
 * `to` = rota; `hash` = âncora dentro da própria página (scroll suave).
 * Sub `hash` só aparece quando o id existe na rota atual (AppNav filtra
 * pós-render, com reavaliação para seções lazy — #200).
 */
export interface NavSub {
  /** chave i18n em nav.subs.* (catálogo src/locales/<locale>/nav.json) */
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
  /** chave i18n em nav.sections.* (catálogo src/locales/<locale>/nav.json) */
  label: string
  icon: string
  /** rota base da seção na rail */
  to: string
  subs: NavSub[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    key: 'dashboards',
    label: 'nav.sections.dashboards',
    icon: 'i-lucide-layout-dashboard',
    to: '/',
    subs: [
      { label: 'nav.subs.dashboards.overview', icon: 'i-lucide-layout-dashboard', to: '/' },
      { label: 'nav.subs.dashboards.devs', icon: 'i-lucide-users', to: '/devs' },
      { label: 'nav.subs.dashboards.health', icon: 'i-lucide-heart-pulse', to: '/health' },
    ],
  },
  {
    key: 'teams',
    label: 'nav.sections.teams',
    icon: 'i-lucide-users-round',
    to: '/teams',
    subs: [
      { label: 'nav.subs.teams.teams', icon: 'i-lucide-users-round', hash: 'times' },
      { label: 'nav.subs.teams.devs', icon: 'i-lucide-user-round', hash: 'devs' },
      { label: 'nav.subs.teams.unmapped', icon: 'i-lucide-user-round-x', hash: 'sem-mapeamento' },
    ],
  },
  {
    key: 'prs',
    label: 'nav.sections.prs',
    icon: 'i-lucide-git-pull-request',
    to: '/prs',
    subs: [
      { label: 'nav.subs.prs.open', icon: 'i-lucide-git-pull-request-arrow', hash: 'abertos' },
      { label: 'nav.subs.prs.cycleTime', icon: 'i-lucide-timer', hash: 'cycle-time' },
      { label: 'nav.subs.prs.reviews', icon: 'i-lucide-message-square-text', hash: 'reviews' },
    ],
  },
  {
    key: 'branches',
    label: 'nav.sections.branches',
    // ícone herdado de Repos (issue #124): a rail não pode repetir ícone de seção
    icon: 'i-lucide-git-branch',
    to: '/branches',
    subs: [
      { label: 'nav.subs.branches.landed', icon: 'i-lucide-plane-landing', hash: 'pousadas' },
      { label: 'nav.subs.branches.abandoned', icon: 'i-lucide-life-buoy', hash: 'abandonadas' },
      { label: 'nav.subs.branches.developProduction', icon: 'i-lucide-git-compare-arrows', hash: 'develop-producao' },
      { label: 'nav.subs.branches.table', icon: 'i-lucide-table', hash: 'tabela' },
    ],
  },
  {
    key: 'repos',
    label: 'nav.sections.repos',
    icon: 'i-lucide-folder-git-2',
    to: '/repos',
    subs: [
      // leva de volta ao índice quando dentro de /repos/:name
      { label: 'nav.subs.repos.all', icon: 'i-lucide-list', to: '/repos' },
      { label: 'nav.subs.repos.table', icon: 'i-lucide-table', hash: 'tabela' },
      { label: 'nav.subs.repos.lines', icon: 'i-lucide-diff', hash: 'linhas' },
      { label: 'nav.subs.repos.distribution', icon: 'i-lucide-chart-pie', hash: 'distribuicao' },
      { label: 'nav.subs.repos.perMonth', icon: 'i-lucide-calendar-days', hash: 'por-mes' },
      { label: 'nav.subs.repos.commitTypes', icon: 'i-lucide-tag', hash: 'tipos' },
      { label: 'nav.subs.repos.releases', icon: 'i-lucide-rocket', hash: 'releases' },
      { label: 'nav.subs.repos.graph', icon: 'i-lucide-git-graph', hash: 'grafo' },
    ],
  },
  {
    key: 'reports',
    label: 'nav.sections.reports',
    icon: 'i-lucide-file-text',
    to: '/reports',
    subs: [
      { label: 'nav.subs.reports.subject', hash: 'assunto' },
      { label: 'nav.subs.reports.report', hash: 'relatorio' },
    ],
  },
]

/** config — isolada no rodapé da rail (padrão Sentry); só no dev server */
export const NAV_BOTTOM: NavSection = {
  key: 'settings',
  label: 'nav.sections.settings',
  icon: 'i-lucide-settings',
  to: '/settings',
  subs: [
    { label: 'nav.subs.settings.general', icon: 'i-lucide-sliders-horizontal', to: '/settings' },
    { label: 'nav.subs.settings.repos', icon: 'i-lucide-list-checks', to: '/settings/repos' },
    { label: 'nav.subs.settings.account', icon: 'i-lucide-github', to: '/settings/account' },
  ],
}
