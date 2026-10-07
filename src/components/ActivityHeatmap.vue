<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import { filteredHeatmap } from '../data'

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const option = computed<EChartsOption>(() => {
  const map = new Map<string, number>()
  let max = 0
  for (const r of filteredHeatmap.value) {
    const k = `${r.weekday}|${r.hour}`
    const v = (map.get(k) ?? 0) + r.commits
    map.set(k, v)
    if (v > max) max = v
  }

  const data: [number, number, number][] = []
  for (const [k, v] of map) {
    const [weekday, hour] = k.split('|').map(Number)
    data.push([hour, weekday, v])
  }

  return {
    tooltip: {
      formatter: (p: unknown) => {
        const d = (p as { data: [number, number, number] }).data
        return `${WEEKDAYS[d[1]]} ${String(d[0]).padStart(2, '0')}h: <b>${d[2]}</b> commits`
      },
    },
    grid: { left: 50, right: 60, top: 10, bottom: 30 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, h) => `${h}h`),
      axisLabel: { color: '#9aa3b2' },
    },
    yAxis: { type: 'category', data: WEEKDAYS, axisLabel: { color: '#9aa3b2' } },
    visualMap: {
      min: 0,
      max: Math.max(max, 1),
      calculable: true,
      orient: 'vertical',
      right: 0,
      top: 'center',
      inRange: { color: ['#171a21', '#143d2b', '#22c55e', '#a7f3d0'] },
      textStyle: { color: '#9aa3b2' },
    },
    series: [{ type: 'heatmap', data }],
  }
})
</script>

<template>
  <div class="panel">
    <h2>Frequência — dia da semana × hora</h2>
    <VChart :option="option" class="chart" autoresize />
  </div>
</template>
