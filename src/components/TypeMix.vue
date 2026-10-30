<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { axisLabel, splitLine, tooltipBase } from '../chartTheme'
import { commitTypeColor } from '../commitTypes'
import { filteredTypes } from '../data'
import { fmtInt } from '../format'
import { typeMix } from '../overview'
import ChartPanel from './ChartPanel.vue'

/**
 * Mix de tipos no período — fatia única da Visão geral (o par por mês/por repo
 * continua no CommitTypes). Barras horizontais por categoria exibida, na mesma
 * taxonomia/cores de `../commitTypes`.
 */
const { t } = useI18n({ useScope: 'global' })

const option = computed<EChartsOption>(() => {
  const rows = typeMix(filteredTypes.value)
  return {
    tooltip: tooltipBase({
      formatter: (p: unknown) => {
        const d = (p as { dataIndex: number }).dataIndex
        const r = rows[d]
        return `${t('chart.types.tipLine', { name: r.type })} <b>${fmtInt(r.commits)}</b> ${t('chart.types.tipTail', { pct: r.pct })}`
      },
    }),
    // ECharts 6: outerBoundsMode/Contain substituem o legado `grid.containLabel`
    grid: { left: 8, right: 30, top: 10, bottom: 10, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    xAxis: { type: 'value', max: 100, axisLabel: axisLabel({ formatter: (v: string | number) => t('chart.pct', { n: v }) }), splitLine: splitLine() },
    yAxis: { type: 'category', data: rows.map(r => r.type), inverse: true, axisLabel: axisLabel() },
    series: [{
      type: 'bar',
      data: rows.map(r => ({ value: r.pct, itemStyle: { color: commitTypeColor(r.type) } })),
      barMaxWidth: 18,
    }],
  }
})
</script>

<template>
  <ChartPanel :title="t('chart.typeMix.title')" icon="i-lucide-tags" :option="option" tall />
</template>
