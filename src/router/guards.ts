import type { Router } from 'vue-router'
import { loadStats, stats } from '@/data'
import { fetchSetupStatus } from '@/setup'
import type { SetupStatus } from '@/setup'
import { readWizardSelection } from '@/wizard'

/** endpoints /__* só existem no dev server (middleware do Vite) */
export const serverMode = import.meta.env.DEV

let bootPromise: Promise<void> | null = null
let statusPromise: Promise<SetupStatus | null> | null = null

/**
 * Boot único: o guard só deixa entrar em rota de dados depois de saber se o
 * stats.json existe (loadStats uma vez; sem 404/HTML-fallback = sem dados).
 * resetBoot() depois de apagar/recoletar para o next navigation reavaliar.
 */
export function ensureBoot(): Promise<void> {
  if (!bootPromise)
    bootPromise = loadStats().then(() => {})
  return bootPromise
}

export function resetBoot(): void {
  bootPromise = null
  statusPromise = null
}

/** status do setup com cache (o guard e as páginas do wizard compartilham) */
export function getCachedStatus(force = false): Promise<SetupStatus | null> {
  if (!serverMode)
    return Promise.resolve(null)
  if (force || !statusPromise)
    statusPromise = fetchSetupStatus().catch(() => null)
  return statusPromise
}

export function invalidateStatus(): void {
  statusPromise = null
}

/** /?tab=<legado> → rotas dedicadas (0.31: prs/repos viraram páginas) */
const LEGACY_TABS: Record<string, string> = {
  overview: '/',
  team: '/devs',
  health: '/health',
  prs: '/prs',
  repos: '/repos',
}

export function setupGuards(router: Router): void {
  router.beforeEach(async (to) => {
    // 0) legado: ?tab=... na home vira rota dedicada preservando os outros params
    const tab = typeof to.query.tab === 'string' ? to.query.tab : undefined
    if (tab && LEGACY_TABS[tab] !== undefined && to.path === '/') {
      const query = { ...to.query }
      delete query.tab
      return { path: LEGACY_TABS[tab], query }
    }

    // 0b) legado: /releases virou seção de /repos (0.35)
    if (to.path === '/releases')
      return { path: '/repos', hash: '#releases', query: to.query }

    // 1) dados: exige o boot (loadStats 1x — também no estático, onde o
    //    stats.json pode vir embutido no dist) antes de qualquer rota de dashboard
    await ensureBoot()
    const hasData = stats.value != null

    // 2) wizard concluído não reabre: /setup/* com dados vira /settings
    if (to.meta.onboarding && hasData)
      return '/settings'

    // 3) rota de dados sem dados → onboarding (no build estático o layout do
    //    setup mostra o aviso de "rode local"; sem loop porque /setup não pede dados)
    if (to.meta.requiresData && !hasData)
      return '/setup'

    // 4) tela de config em build estático: endpoints /__* não existem
    if (to.meta.requiresServer && !serverMode)
      return stats.value != null ? '/' : '/setup'

    // 5) wizard: passo >= 2 precisa de auth; index decide o passo pela auth;
    //    passo 3 precisa de seleção feita no passo 2 (sessionStorage)
    if (to.meta.onboarding && serverMode) {
      if (to.meta.setupStep && to.meta.setupStep >= 2) {
        const status = await getCachedStatus()
        if (!status?.auth)
          return '/setup/github'
      }
      if (to.name === '/setup') {
        const status = await getCachedStatus()
        return status?.auth ? '/setup/repos' : '/setup/github'
      }
      if (to.meta.setupStep === 3 && !readWizardSelection())
        return '/setup/repos'
    }

    return true
  })
}
