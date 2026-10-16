<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { ct, legendText, PALETTE, tooltipBase } from '../chartTheme'
import { commitsByRepo } from '../data'
import ChartPanel from './ChartPanel.vue'

const option = computed<EChartsOption>(() => ({
  color: PALETTE,
  tooltip: tooltipBase({ trigger: 'item', formatter: '{b}: {c} commits ({d}%)' }),
  legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: legendText() },
  series: [{
    type: 'pie',
    radius: ['45%', '75%'],
    center: ['40%', '50%'],
    itemStyle: { borderColor: ct.bg, borderWidth: 2 },
    label: { show: false },
    data: commitsByRepo.value.map(r => ({ name: r.repo, value: r.commits })),
  }],
}))
</script>

<template>
  <ChartPanel title="Distribuição por repositório (período filtrado)" :option="option" />
</template>
