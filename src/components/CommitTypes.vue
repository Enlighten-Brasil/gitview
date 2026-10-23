<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { axisLabel, legendText, splitLine, tooltipBase } from '../chartTheme'
import { COMMIT_TYPES, commitTypeColor, commitTypeGroup } from '../commitTypes'
import { filteredTypes, nestBySum } from '../data'
import { fmtInt } from '../format'
import ChartPanel from './ChartPanel.vue'

const { t } = useI18n({ useScope: 'global' })

/** mix por mês (%) — stacked bar */
const monthOption = computed<EChartsOption>(() => {
  // mês → tipo agrupado → commits (agregação compartilhada — issue #41)
  const byMonth = nestBySum(filteredTypes.value, r => r.month, r => commitTypeGroup(r.type))
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
          .map((i) => {
            const pct = Math.round((i.value / total) * 100)
            return `${t('chart.types.tipLine', { name: i.seriesName })} <b>${i.value}</b> ${t('chart.types.tipTail', { pct })}`
          })
        return `${items[0]?.axisValue ?? ''}<br>${lines.join('<br>')}`
      },
    }),
    legend: { top: 0, right: 0, textStyle: legendText() },
    grid: { left: 40, right: 20, top: 30, bottom: 24 },
    xAxis: { type: 'category', data: months, axisLabel: axisLabel() },
    yAxis: { type: 'value', axisLabel: axisLabel(), splitLine: splitLine() },
    series: COMMIT_TYPES.map(t => ({
      name: t,
      type: 'bar' as const,
      stack: 'types',
      data: months.map(m => byMonth.get(m)?.get(t) ?? 0),
      itemStyle: { color: commitTypeColor(t) },
      barMaxWidth: 26,
    })),
  }
})

/** mix por repo (%) — barras horizontais, ordenado por % de fix (quem apaga incêndio) */
const repoOption = computed<EChartsOption>(() => {
  // repo → tipo agrupado → commits (agregação compartilhada — issue #41)
  const byRepo = nestBySum(filteredTypes.value, r => r.repo, r => commitTypeGroup(r.type))
  const rows = [...byRepo.entries()]
    .map(([repo, m]) => {
      const total = [...m.values()].reduce((s, v) => s + v, 0)
      const pct = (t: string) => total > 0 ? Math.round(((m.get(t) ?? 0) / total) * 1000) / 10 : 0
      return { repo, total, fixPct: pct('fix'), pcts: COMMIT_TYPES.map(t => pct(t)) }
    })
    .sort((a, b) => b.fixPct - a.fixPct)

  return {
    tooltip: tooltipBase({
      formatter: (p: unknown) => {
        const d = (p as { dataIndex: number }).dataIndex
        const r = rows[d]
        const lines = COMMIT_TYPES
          .map((t, i) => ({ t, v: r.pcts[i] }))
          .filter(x => x.v > 0)
          .sort((a, b) => b.v - a.v)
          .map(x => `${t('chart.types.pctLine', { type: x.t })} <b>${t('chart.pct', { n: x.v })}</b>`)
        return `${t('chart.types.repoTipHead', { repo: r.repo, n: fmtInt(r.total) })}<br>${lines.join('<br>')}`
      },
    }),
    legend: { top: 0, right: 0, textStyle: legendText() },
    // ECharts 6: outerBoundsMode/Contain substituem o legado `grid.containLabel`
    grid: { left: 8, right: 30, top: 30, bottom: 10, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    xAxis: { type: 'value', max: 100, axisLabel: axisLabel({ formatter: (v: string | number) => t('chart.pct', { n: v }) }), splitLine: splitLine() },
    yAxis: { type: 'category', data: rows.map(r => r.repo), inverse: true, axisLabel: axisLabel() },
    series: COMMIT_TYPES.map((t, i) => ({
      name: t,
      type: 'bar' as const,
      stack: 'types',
      data: rows.map(r => r.pcts[i]),
      itemStyle: { color: commitTypeColor(t) },
      barMaxWidth: 18,
    })),
  }
})
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <ChartPanel :title="t('chart.types.monthTitle')" icon="i-lucide-chart-column-stacked" :option="monthOption" tall />
    <ChartPanel :title="t('chart.types.repoTitle')" icon="i-lucide-wrench" :option="repoOption" tall />
  </div>
</template>
