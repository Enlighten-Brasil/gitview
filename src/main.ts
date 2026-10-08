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
import './main.css'

use([
  BarChart, HeatmapChart, LineChart, PieChart,
  CalendarComponent, DataZoomComponent, GridComponent, LegendComponent,
  TitleComponent, TooltipComponent, VisualMapComponent,
  CanvasRenderer,
])

// rotas: dashboard (tabs + filtros na query string) e perfil dedicado do dev
const router = createRouter({
  routes: [
    { path: '/', name: 'dashboard', component: DashboardView },
    { path: '/dev/:name', name: 'dev', component: DevView },
  ],
  history: createWebHistory(),
})

createApp(App)
  .use(router)
  .use(ui)
  .component('VChart', VChart)
  .mount('#app')
