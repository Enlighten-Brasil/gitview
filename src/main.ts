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
import App from './App.vue'
import './style.css'

use([
  BarChart, HeatmapChart, LineChart, PieChart,
  CalendarComponent, DataZoomComponent, GridComponent, LegendComponent,
  TitleComponent, TooltipComponent, VisualMapComponent,
  CanvasRenderer,
])

createApp(App).component('VChart', VChart).mount('#app')
