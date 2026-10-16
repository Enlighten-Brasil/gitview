<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { axisLabel, ct, heatRamp, tooltipBase } from '../chartTheme'
import { filteredMonthly } from '../data'
import ChartPanel from './ChartPanel.vue'

const option = computed<EChartsOption>(() => {
  const rows = filteredMonthly.value
  const map = new Map<string, number>()
  const totals = new Map<string, number>()
  for (const r of rows) {
    const k = `${r.author}|${r.month}`
    map.set(k, (map.get(k) ?? 0) + r.commits)
    totals.set(r.author, (totals.get(r.author) ?? 0) + r.commits)
  }

  const months = [...new Set(rows.map(r => r.month))].sort()
  // autores ordenados por volume no período — quem mais commita fica no topo
  const authors = [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([a]) => a)

  const data: [number, number, number][] = []
  let max = 0
  for (const [k, v] of map) {
    const [author, month] = k.split('|')
    const x = months.indexOf(month)
    const y = authors.indexOf(author)
    if (x >= 0 && y >= 0) {
      data.push([x, y, v])
      if (v > max)
        max = v
    }
  }

  return {
    tooltip: tooltipBase({
      formatter: (p: unknown) => {
        const d = (p as { data: [number, number, number] }).data
        return `${authors[d[1]]} — ${months[d[0]]}: <b>${d[2]}</b> commits`
      },
    }),
    grid: { left: 130, right: 60, top: 10, bottom: 60 },
    xAxis: { type: 'category', data: months, axisLabel: axisLabel({ rotate: 45 }) },
    yAxis: { type: 'category', data: authors, axisLabel: axisLabel() },
    visualMap: {
      min: 0,
      max: Math.max(max, 1),
      calculable: true,
      orient: 'vertical',
      right: 0,
      top: 'center',
      inRange: { color: heatRamp('violet') },
      textStyle: { color: ct.text },
    },
    series: [{ type: 'heatmap', data }],
  }
})
</script>

<template>
  <ChartPanel title="Dev × mês (comparação)" :option="option" tall />
</template>
