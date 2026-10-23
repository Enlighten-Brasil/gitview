<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useHeatmapMatrix } from '../charts/useHeatmapMatrix'
import { filteredMonthly } from '../data'
import ChartPanel from './ChartPanel.vue'

const { t } = useI18n({ useScope: 'global' })

const option = useHeatmapMatrix({
  rows: filteredMonthly,
  xKey: 'month',
  yKey: 'repo',
  ramp: 'primary',
  xRotate: 45,
})
</script>

<template>
  <ChartPanel :title="t('chart.heat.repoMonth')" :option="option" tall />
</template>
