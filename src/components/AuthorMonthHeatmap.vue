<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useHeatmapMatrix } from '../charts/useHeatmapMatrix'
import { filteredMonthly } from '../data'
import ChartPanel from './ChartPanel.vue'

const { t } = useI18n({ useScope: 'global' })

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
  <ChartPanel :title="t('chart.heat.authorMonth')" :option="option" tall />
</template>
