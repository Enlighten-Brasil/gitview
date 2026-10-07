<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import { selectedDev, stats } from '../data'

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const authorStats = computed(() =>
  stats.value?.perAuthor.find(a => a.author === selectedDev.value) ?? null,
)

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString('pt-BR')
}

const cards = computed(() => {
  const a = authorStats.value
  if (!a) return []
  return [
    { value: fmt(a.commits), label: 'commits' },
    { value: fmt(a.additions), label: 'linhas +' },
    { value: fmt(a.deletions), label: 'linhas −' },
    { value: String(a.activeDays), label: 'dias ativos' },
    { value: (a.commits / Math.max(a.activeDays, 1)).toFixed(1), label: 'commits/dia ativo' },
    { value: `${a.streak} (máx ${a.longestStreak})`, label: 'streak 🔥' },
    { value: String(a.repos), label: 'repositórios' },
  ]
})

const timelineOption = computed<EChartsOption>(() => {
  const rows = (stats.value?.weekly ?? []).filter(r => r.author === selectedDev.value)
  const byWeek = new Map<string, number>()
  for (const r of rows) byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + r.commits)
  const weeks = [...byWeek.keys()].sort()

  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 60 },
    xAxis: { type: 'category', data: weeks, axisLabel: { color: '#9aa3b2' } },
    yAxis: { type: 'value', axisLabel: { color: '#9aa3b2' }, splitLine: { lineStyle: { color: '#262b36' } } },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    series: [{ type: 'bar', data: weeks.map(w => byWeek.get(w) ?? 0), itemStyle: { color: '#4f8cff' } }],
  }
})

const repoOption = computed<EChartsOption>(() => {
  const map = new Map<string, number>()
  for (const r of stats.value?.monthly ?? []) {
    if (r.author !== selectedDev.value) continue
    map.set(r.repo, (map.get(r.repo) ?? 0) + r.commits)
  }
  const data = [...map.entries()].map(([repo, commits]) => ({ name: repo, value: commits })).sort((a, b) => b.value - a.value)

  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} commits ({d}%)' },
    legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: { color: '#9aa3b2' } },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['38%', '50%'],
      itemStyle: { borderColor: '#171a21', borderWidth: 2 },
      label: { show: false },
      data,
    }],
  }
})

const heatOption = computed<EChartsOption>(() => {
  const map = new Map<string, number>()
  let max = 0
  for (const r of stats.value?.heatmap ?? []) {
    if (r.author !== selectedDev.value) continue
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
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, h) => `${h}h`), axisLabel: { color: '#9aa3b2' } },
    yAxis: { type: 'category', data: WEEKDAYS, axisLabel: { color: '#9aa3b2' } },
    visualMap: {
      min: 0,
      max: Math.max(max, 1),
      show: false,
      inRange: { color: ['#171a21', '#143d2b', '#22c55e', '#a7f3d0'] },
    },
    series: [{ type: 'heatmap', data }],
  }
})
</script>

<template>
  <UCard v-if="selectedDev" class="ring-primary/50!">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user" class="size-5 text-primary" />
        <h2 class="font-semibold text-highlighted">
          {{ selectedDev }}
        </h2>
        <span class="text-xs text-dimmed">— histórico completo</span>
        <UButton
          icon="i-lucide-x"
          label="fechar"
          color="neutral"
          variant="ghost"
          size="xs"
          class="ml-auto"
          @click="selectedDev = null"
        />
      </div>
    </template>

    <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
      <div
        v-for="c in cards"
        :key="c.label"
        class="rounded-lg bg-elevated/50 px-3 py-2.5"
      >
        <div class="text-lg font-bold text-highlighted leading-tight">{{ c.value }}</div>
        <div class="text-[11px] text-dimmed uppercase tracking-wide">{{ c.label }}</div>
      </div>
    </div>

    <VChart :option="timelineOption" class="chart" autoresize />
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <VChart :option="repoOption" class="chart" autoresize />
      <VChart :option="heatOption" class="chart" autoresize />
    </div>
  </UCard>
</template>
