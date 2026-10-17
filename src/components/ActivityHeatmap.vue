<script setup lang="ts">
import { useWeekdayHourHeatmap } from '../charts/useHeatmapMatrix'
import { filteredHeatmap } from '../data'
import ChartPanel from './ChartPanel.vue'

const option = useWeekdayHourHeatmap({ rows: filteredHeatmap })
</script>

<template>
  <ChartPanel title="Frequência — dia da semana × hora" :option="option" />
</template>
