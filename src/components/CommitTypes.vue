<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { axisLabel, ct, legendText, splitLine, tooltipBase } from '../chartTheme'
import { filteredTypes } from '../data'
import { fmtInt } from '../format'
import ChartPanel from './ChartPanel.vue'

/** categorias exibidas (docs/test/perf/style/build/ci viram "outros") */
const CATEGORIES = ['feat', 'fix', 'refactor', 'chore', 'outros'] as const
const COLORS: Record<string, string> = {
  feat: ct.primary,
  fix: ct.error500,
  refactor: ct.violet500,
  chore: ct.warning500,
  outros: ct.textDim,
}

function group(type: string): (typeof CATEGORIES)[number] {
  return (CATEGORIES as readonly string[]).includes(type) ? type as (typeof CATEGORIES)[number] : 'outros'
}

/** mix por mês (%) — stacked bar */
const monthOption = computed<EChartsOption>(() => {
  const byMonth = new Map<string, Map<string, number>>()
  for (const r of filteredTypes.value) {
    if (!byMonth.has(r.month))
      byMonth.set(r.month, new Map())
    const m = byMonth.get(r.month)!
    const t = group(r.type)
    m.set(t, (m.get(t) ?? 0) + r.commits)
  }
  const months = [...byMonth.keys()].sort()

  return {
    tooltip: tooltipBase({
      trigger: 'axis',
      formatter: (ps: unknown) => {
        const items = ps as { seriesName: string, value: number, axisValue: string }[]
        const total = items.reduce((s, i) => s + i.value, 0)
        const lines = items
          .filter(i => i.value > 0)
          .sort((a, b) => b.value - a.value)
          .map(i => `${i.seriesName}: <b>${i.value}</b> (${Math.round((i.value / total) * 100)}%)`)
        return `${items[0]?.axisValue ?? ''}<br>${lines.join('<br>')}`
      },
    }),
    legend: { top: 0, right: 0, textStyle: legendText() },
    grid: { left: 40, right: 20, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: months, axisLabel: axisLabel() },
    yAxis: { type: 'value', axisLabel: axisLabel(), splitLine: splitLine() },
    series: CATEGORIES.map(t => ({
      name: t,
      type: 'bar' as const,
      stack: 'types',
      data: months.map(m => byMonth.get(m)?.get(t) ?? 0),
      itemStyle: { color: COLORS[t] },
      barMaxWidth: 26,
    })),
  }
})

/** mix por repo (%) — barras horizontais, ordenado por % de fix (quem apaga incêndio) */
const repoOption = computed<EChartsOption>(() => {
  const byRepo = new Map<string, Map<string, number>>()
  for (const r of filteredTypes.value) {
    if (!byRepo.has(r.repo))
      byRepo.set(r.repo, new Map())
    const m = byRepo.get(r.repo)!
    const t = group(r.type)
    m.set(t, (m.get(t) ?? 0) + r.commits)
  }
  const rows = [...byRepo.entries()]
    .map(([repo, m]) => {
      const total = [...m.values()].reduce((s, v) => s + v, 0)
      const pct = (t: string) => total > 0 ? Math.round(((m.get(t) ?? 0) / total) * 1000) / 10 : 0
      return { repo, total, fixPct: pct('fix'), pcts: CATEGORIES.map(t => pct(t)) }
    })
    .sort((a, b) => b.fixPct - a.fixPct)

  return {
    tooltip: tooltipBase({
      formatter: (p: unknown) => {
        const d = (p as { dataIndex: number }).dataIndex
        const r = rows[d]
        const lines = CATEGORIES
          .map((t, i) => ({ t, v: r.pcts[i] }))
          .filter(x => x.v > 0)
          .sort((a, b) => b.v - a.v)
          .map(x => `${x.t}: <b>${x.v}%</b>`)
        return `${r.repo} (${fmtInt(r.total)} commits)<br>${lines.join('<br>')}`
      },
    }),
    legend: { top: 0, right: 0, textStyle: legendText() },
    // ECharts 6: outerBoundsMode/Contain substituem o legado `grid.containLabel`
    grid: { left: 8, right: 30, top: 30, bottom: 10, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    xAxis: { type: 'value', max: 100, axisLabel: axisLabel({ formatter: '{value}%' }), splitLine: splitLine() },
    yAxis: { type: 'category', data: rows.map(r => r.repo), inverse: true, axisLabel: axisLabel() },
    series: CATEGORIES.map((t, i) => ({
      name: t,
      type: 'bar' as const,
      stack: 'types',
      data: rows.map(r => r.pcts[i]),
      itemStyle: { color: COLORS[t] },
      barMaxWidth: 18,
    })),
  }
})
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <ChartPanel title="Tipos de commit por mês (feat × fix × ...)" icon="i-lucide-chart-column-stacked" :option="monthOption" tall />
    <ChartPanel title="Mix por repo (% — ordenado por fix)" icon="i-lucide-wrench" :option="repoOption" tall />
  </div>
</template>
