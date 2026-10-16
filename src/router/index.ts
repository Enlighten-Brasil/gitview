import { createRouter, createWebHistory } from 'vue-router'
import { handleHotUpdate, routes } from 'vue-router/auto-routes'
import { setupGuards } from './guards'
import { setupScroll } from './scroll'

// rotas por arquivo em src/pages (file-based routing do vue-router 5; nomes sem
// os grupos (app)/(dashboard) via getRouteName no vite.config). O split de
// chunk por rota vem do importMode async default do plugin.
export const router = createRouter({
  routes,
  history: createWebHistory(import.meta.env.BASE_URL),
})

// gate de dados/wizard (?tab= legado, /setup vs /settings, passos do wizard)
setupGuards(router)
// scroll dentro do painel (o container é o body do UDashboardPanel, não a janela)
setupScroll(router)

// atualizar rotas sem reload (definePage/<route> em arquivos de src/pages)
if (import.meta.hot)
  handleHotUpdate(router)
