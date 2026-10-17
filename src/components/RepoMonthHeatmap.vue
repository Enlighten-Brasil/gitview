<script setup lang="ts">
import { useHeatmapMatrix } from '../charts/useHeatmapMatrix'
import { filteredMonthly } from '../data'
import ChartPanel from './ChartPanel.vue'

const option = useHeatmapMatrix({
  rows: filteredMonthly,
  xKey: 'month',
  yKey: 'repo',
  ramp: 'primary',
  xRotate: 45,
})
</script>

<template>
  <ChartPanel title="Repositório × mês" :option="option" tall />
</template>
