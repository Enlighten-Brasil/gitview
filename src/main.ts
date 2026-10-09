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
    // seções dedicadas (two-pane nav); /prs e /repos redirecionam pras tabs atuais
    { path: '/prs', name: 'prs', component: defineAsyncComponent(() => import('./views/PrsView.vue')) },
    { path: '/repos', name: 'repos', component: defineAsyncComponent(() => import('./views/ReposView.vue')) },
    { path: '/releases', name: 'releases', component: defineAsyncComponent(() => import('./views/ReleasesView.vue')) },
    // onboarding/configuração pela UI (só funciona em dev — endpoints do Vite)
    { path: '/setup', name: 'setup', component: defineAsyncComponent(() => import('./views/SetupView.vue')) },
  ],
  history: createWebHistory(),
})

// scroll: o conteúdo rola dentro do body do UDashboardPanel (overflow-y-auto),
// não na janela — o scrollBehavior do router (window.scrollTo) não faz nada aqui
router.afterEach((to, from) => {
  if (to.hash) {
    // conteúdo async: espera o anchor existir e rola o container até ele;
    // re-rola depois porque os gráficos ECharts renderizam atrasado e empurram
    // o layout pra baixo
    let attempts = 0
    const scroll = () => document.querySelector(to.hash)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const find = () => {
      if (document.querySelector(to.hash)) {
        scroll()
        setTimeout(scroll, 500)
        setTimeout(scroll, 1500)
      }
      else if (++attempts < 50) {
        setTimeout(find, 100)
      }
    }
    find()
  }
  else if (to.path !== from.path) {
    document.querySelector<HTMLElement>('.overflow-y-auto')?.scrollTo({ top: 0 })
  }
})

createApp(App)
  .use(router)
  .use(ui)
  .mount('#app')
