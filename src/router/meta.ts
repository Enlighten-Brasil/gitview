import type { RouteNamedMap } from 'vue-router/auto-routes'
import 'vue-router'

/**
 * Meta das rotas — é o contrato entre os arquivos de src/pages, o guard global
 * (guards.ts), a navegação (nav.ts) e os filtros (urlState/FilterBar).
 * definePage() não aceita guards (antes de entrar use meta + guard global).
 */

/** nomes de rota gerados em src/route-map.d.ts (issue #42) — typo de nome quebra o typecheck */
export type RouteName = keyof RouteNamedMap

/**
 * escopo de filtros da rota (issue #42) — única fonte do tipo (antes declarado
 * 3× em urlState.ts / FilterBar.vue / meta.ts)
 */
export type FilterScope = 'full' | 'team' | 'period' | 'period-bots' | 'none'

/**
 * rotas de detalhe (issue #42) — o navbar mostra o param `name` no título.
 * Tipado por RouteName: um nome digitado errado não compila.
 */
export const DETAIL_ROUTES: Set<RouteName> = new Set(['/devs/[name]', '/repos/[name]', '/teams/[name]'])

declare module 'vue-router' {
  interface RouteMeta {
    /** precisa de dados coletados (stats.json); sem dados o guard leva a /setup */
    requiresData?: boolean
    /** rota do wizard de onboarding; com dados o guard leva a /settings */
    onboarding?: boolean
    /** usa endpoints locais (/__*): build estático não entra */
    requiresServer?: boolean
    /** passo mínimo do wizard (2 repos, 3 coletar, 4 time opcional) — 2/3 exigem auth; 4 exige dados coletados */
    setupStep?: number
    /** seção ativa na rail (nav.ts) — substitui o match por prefixo */
    section?: 'dashboards' | 'teams' | 'prs' | 'branches' | 'repos' | 'reports' | 'settings' | null
    /**
     * quais filtros a sidebar e a URL carregam nesta rota
     * ('team' = período + repos; os devs são travados pela página em filters.authors)
     */
    filters?: FilterScope
    /** título fixo do navbar (rota de detalhe usa o param no lugar) */
    title?: string
  }
}
