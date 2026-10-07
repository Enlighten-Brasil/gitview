<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { filteredMonthly, filteredWeekly } from '../data'

const granularity = ref<'week' | 'month'>('week')

const option = computed<EChartsOption>(() => {
  const rows = granularity.value === 'week' ? filteredWeekly.value : filteredMonthly.value
  const keyField = granularity.value === 'week' ? 'week' : 'month'

  const periods = [...new Set(rows.map(r => r[keyField as 'week' | 'month']))].sort()
  const authors = [...new Set(rows.map(r => r.author))].sort()

  const series = authors.map(author => {
    const byPeriod = new Map<string, number>()
    for (const r of rows) {
      if (r.author !== author) continue
      const k = r[keyField as 'week' | 'month']
      byPeriod.set(k, (byPeriod.get(k) ?? 0) + r.commits)
    }
    return {
      name: author,
      type: 'bar' as const,
      stack: 'commits',
      emphasis: { focus: 'series' as const },
      data: periods.map(p => byPeriod.get(p) ?? 0),
    }
  })

  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { type: 'scroll', textStyle: { color: '#9aa3b2' } },
    grid: { left: 50, right: 20, top: 40, bottom: 60 },
    xAxis: { type: 'category', data: periods, axisLabel: { color: '#9aa3b2' } },
    yAxis: { type: 'value', axisLabel: { color: '#9aa3b2' }, splitLine: { lineStyle: { color: '#262b36' } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    series,
  }
})
</script>

<template>
  <div class="panel">
    <h2>
      Commits por {{ granularity === 'week' ? 'semana' : 'mês' }} (por dev)
      <span class="range-group" style="float: right">
        <button class="range-btn" :class="{ active: granularity === 'week' }" @click="granularity = 'week'">semana</button>
        <button class="range-btn" :class="{ active: granularity === 'month' }" @click="granularity = 'month'">mês</button>
      </span>
    </h2>
    <VChart :option="option" class="chart-tall" autoresize />
  </div>
</template>
