import { createApp } from 'vue'
import { use } from 'echarts/core'
import { BarChart, HeatmapChart, LineChart, PieChart } from 'echarts/charts'
import {
  CalendarComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { createRouter, createWebHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'
import App from './App.vue'
import DashboardView from './views/DashboardView.vue'
import DevView from './views/DevView.vue'
import RepoView from './views/RepoView.vue'
import SetupView from './views/SetupView.vue'
import TeamView from './views/TeamView.vue'
import './main.css'

use([
  BarChart, HeatmapChart, LineChart, PieChart,
  CalendarComponent, DataZoomComponent, GridComponent, LegendComponent,
  TitleComponent, TooltipComponent, VisualMapComponent,
  CanvasRenderer,
])

// rotas: dashboard (tabs + filtros na query string), perfil do dev e página do repo
const router = createRouter({
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/dev/:name', name: 'dev', component: DevView },
    { path: '/repo/:name', name: 'repo', component: RepoView },
    // time: perfis de devs, aliases e times (edição só em dev)
    { path: '/team', name: 'team', component: TeamView },
    // onboarding/configuração pela UI (só funciona em dev — endpoints do Vite)
    { path: '/setup', name: 'setup', component: SetupView },
  ],
  history: createWebHistory(),
})

createApp(App)
  .use(router)
  .use(ui)
  .component('VChart', VChart)
  .mount('#app')
