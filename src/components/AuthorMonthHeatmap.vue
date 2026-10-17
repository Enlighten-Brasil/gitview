<script setup lang="ts">
import { useHeatmapMatrix } from '../charts/useHeatmapMatrix'
import { filteredMonthly } from '../data'
import ChartPanel from './ChartPanel.vue'

// autores ordenados por volume no período — quem mais commita fica no topo
const option = useHeatmapMatrix({
  rows: filteredMonthly,
  xKey: 'month',
  yKey: 'author',
  ramp: 'violet',
  order: { y: 'volume' },
  xRotate: 45,
})
</script>

<template>
  <ChartPanel title="Dev × mês (comparação)" :option="option" tall />
</template>
