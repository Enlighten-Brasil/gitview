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
      { label: 'Devs', icon: 'i-lucide-users', to: '/devs' },
      { label: 'Saúde', icon: 'i-lucide-heart-pulse', to: '/health' },
    ],
  },
  {
    key: 'teams',
    label: 'Times',
    icon: 'i-lucide-users-round',
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
    key: 'branches',
    label: 'Branches',
    // ícone herdado de Repos (issue #124): a rail não pode repetir ícone de seção
    icon: 'i-lucide-git-branch',
    to: '/branches',
    subs: [
      { label: 'Pousadas', icon: 'i-lucide-plane-landing', hash: 'pousadas' },
      { label: 'Abandonadas', icon: 'i-lucide-life-buoy', hash: 'abandonadas' },
      { label: 'develop × produção', icon: 'i-lucide-git-compare-arrows', hash: 'develop-producao' },
      { label: 'Tabela', icon: 'i-lucide-table', hash: 'tabela' },
    ],
  },
  {
    key: 'repos',
    label: 'Repos',
    icon: 'i-lucide-folder-git-2',
    to: '/repos',
    subs: [
      // leva de volta ao índice quando dentro de /repos/:name
      { label: 'Todos os repositórios', icon: 'i-lucide-list', to: '/repos' },
      { label: 'Tabela', icon: 'i-lucide-table', hash: 'tabela' },
      { label: 'Linhas +/−', icon: 'i-lucide-diff', hash: 'linhas' },
      { label: 'Distribuição', icon: 'i-lucide-chart-pie', hash: 'distribuicao' },
      { label: 'Por mês', icon: 'i-lucide-calendar-days', hash: 'por-mes' },
      { label: 'Tipos de commit', icon: 'i-lucide-tag', hash: 'tipos' },
      { label: 'Releases', icon: 'i-lucide-rocket', hash: 'releases' },
      { label: 'Grafo', icon: 'i-lucide-git-graph', hash: 'grafo' },
    ],
  },
  {
    key: 'reports',
    label: 'Relatórios',
    icon: 'i-lucide-file-text',
    to: '/reports',
    subs: [
      { label: 'Assunto e período', hash: 'assunto' },
      { label: 'Relatório', hash: 'relatorio' },
    ],
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
