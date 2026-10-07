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
import './main.css'

use([
  BarChart, HeatmapChart, LineChart, PieChart,
  CalendarComponent, DataZoomComponent, GridComponent, LegendComponent,
  TitleComponent, TooltipComponent, VisualMapComponent,
  CanvasRenderer,
])

// Nuxt UI (ULink etc.) espera um vue-router registrado, mesmo sem rotas
const router = createRouter({
  routes: [],
  history: createWebHistory(),
})

createApp(App)
  .use(router)
  .use(ui)
  .component('VChart', VChart)
  .mount('#app')
