<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { axisLabel, ct, splitLine, tooltipBase } from '../chartTheme'
import { fmtDuration } from '../format'
import { cycleByRepo, medianCycleHours } from '../github'
import ChartPanel from './ChartPanel.vue'

const option = computed<EChartsOption>(() => {
  const rows = [...cycleByRepo.value].reverse() // horizontal: maior no topo
  return {
    tooltip: tooltipBase({
      formatter: (p: unknown) => {
        const d = (p as { dataIndex: number }).dataIndex
        const r = rows[d]
        return `${r.repo}: <b>${fmtDuration(r.medianHours)}</b> (mediana de ${r.count} PRs)`
      },
    }),
    // ECharts 6: outerBoundsMode/Contain substituem o legado `grid.containLabel`
    grid: { left: 8, right: 60, top: 10, bottom: 10, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    xAxis: {
      type: 'value',
      axisLabel: axisLabel({ formatter: (v: number) => fmtDuration(v) }),
      splitLine: splitLine(),
    },
    yAxis: { type: 'category', data: rows.map(r => r.repo), axisLabel: axisLabel() },
    series: [{
      type: 'bar',
      data: rows.map(r => ({
        value: Math.round(r.medianHours * 10) / 10,
        itemStyle: { color: r.medianHours > medianCycleHours.value * 1.5 ? ct.error500 : ct.primary },
      })),
      barMaxWidth: 18,
      label: {
        show: true,
        position: 'right',
        formatter: (p: { value: number }) => fmtDuration(p.value),
        color: ct.textDim,
        fontSize: 11,
      },
    }],
  }
})
</script>

<template>
  <ChartPanel title="Cycle time mediano por repo (criação → merge)" icon="i-lucide-timer" :option="option" tall />
</template>
