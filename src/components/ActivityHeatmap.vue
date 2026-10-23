<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useWeekdayHourHeatmap } from '../charts/useHeatmapMatrix'
import { filteredHeatmap } from '../data'
import ChartPanel from './ChartPanel.vue'

const { t } = useI18n({ useScope: 'global' })
const option = useWeekdayHourHeatmap({ rows: filteredHeatmap })
</script>

<template>
  <ChartPanel :title="t('chart.heat.freq')" :option="option" />
</template>
