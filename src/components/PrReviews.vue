<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { axisLabel, ct, legendText, splitLine, tooltipBase } from '../chartTheme'
import { reviewsByDev } from '../github'
import ChartPanel from './ChartPanel.vue'

const option = computed<EChartsOption>(() => {
  const rows = [...reviewsByDev.value].reverse() // horizontal: maior no topo
  return {
    tooltip: tooltipBase({ trigger: 'axis' }),
    legend: { top: 0, right: 0, textStyle: legendText() },
    grid: { left: 8, right: 30, top: 30, bottom: 10, containLabel: true },
    xAxis: { type: 'value', axisLabel: axisLabel(), splitLine: splitLine() },
    yAxis: { type: 'category', data: rows.map(r => r.dev), axisLabel: axisLabel() },
    series: [
      {
        name: 'aprovações',
        type: 'bar',
        stack: 'reviews',
        data: rows.map(r => r.approvals),
        itemStyle: { color: ct.success500 },
        barMaxWidth: 18,
      },
      {
        name: 'pediu mudanças',
        type: 'bar',
        stack: 'reviews',
        data: rows.map(r => r.changes),
        itemStyle: { color: ct.warning500 },
        barMaxWidth: 18,
      },
      {
        name: 'comentários',
        type: 'bar',
        stack: 'reviews',
        data: rows.map(r => r.total - r.approvals - r.changes),
        itemStyle: { color: ct.primary300 },
        barMaxWidth: 18,
      },
    ],
  }
})
</script>

<template>
  <ChartPanel title="Reviews por dev (no período)" icon="i-lucide-eye" :option="option" tall />
</template>
