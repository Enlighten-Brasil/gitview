// VChart global sem import de echarts aqui — a config real fica em src/echarts-config.ts.
import { createApp, defineAsyncComponent } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import './main.css'

// rotas: dashboard (tabs + filtros na query string), perfil do dev e página do repo
// Views lazy: cada rota vira um chunk próprio. Echarts fica só nos chunks que
// usam gráfico (via ChartPanel) — /team e /setup não pagam esse peso.
const router = createRouter({
  routes: [
    { path: '/', name: 'dashboard', component: defineAsyncComponent(() => import('./views/DashboardView.vue')) },
    { path: '/dev/:name', name: 'dev', component: defineAsyncComponent(() => import('./views/DevView.vue')) },
    { path: '/repo/:name', name: 'repo', component: defineAsyncComponent(() => import('./views/RepoView.vue')) },
    // time: perfis de devs, aliases e times (edição só em dev)
    { path: '/team', name: 'team', component: defineAsyncComponent(() => import('./views/TeamView.vue')) },
    // onboarding/configuração pela UI (só funciona em dev — endpoints do Vite)
    { path: '/setup', name: 'setup', component: defineAsyncComponent(() => import('./views/SetupView.vue')) },
  ],
  history: createWebHistory(),
})

createApp(App)
  .use(router)
  .use(ui)
  .mount('#app')
