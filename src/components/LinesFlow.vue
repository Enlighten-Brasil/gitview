<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { axisLabel, ct, legendText, splitLine, tooltipBase } from '../chartTheme'
import { filteredMonthly, groupBySum } from '../data'
import { fmtCompact, fmtInt } from '../format'
import ChartPanel from './ChartPanel.vue'

// fluxo de linhas (+ adicionadas / − removidas) por mês ou acumulado — "andamento" do código
const mode = ref<'month' | 'cumulative'>('month')

const { t } = useI18n({ useScope: 'global' })

const option = computed<EChartsOption>(() => {
  // mês → linhas +/− (agregação compartilhada — issue #41)
  const addByMonth = groupBySum(filteredMonthly.value, r => r.month, r => r.additions)
  const delByMonth = groupBySum(filteredMonthly.value, r => r.month, r => r.deletions)
  const months = [...addByMonth.keys()].sort()
  const adds = months.map(m => addByMonth.get(m) ?? 0)
  const dels = months.map(m => delByMonth.get(m) ?? 0)

  const axis = {
    xAxis: { type: 'category', data: months, axisLabel: axisLabel() },
    yAxis: { type: 'value', axisLabel: axisLabel({ formatter: fmtCompact }), splitLine: splitLine() },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
  }

  if (mode.value === 'month') {
    return {
      tooltip: tooltipBase({ trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: unknown) => fmtInt(Number(v)) }),
      legend: { data: [t('chart.lines.added'), t('chart.lines.removed'), t('chart.lines.net')], textStyle: legendText() },
      grid: { left: 60, right: 20, top: 40, bottom: 60 },
      ...axis,
      series: [
        {
          name: t('chart.lines.added'),
          type: 'bar',
          itemStyle: { color: ct.success500 },
          emphasis: { focus: 'series' },
          data: adds,
        },
        {
          name: t('chart.lines.removed'),
          type: 'bar',
          itemStyle: { color: ct.error500 },
          emphasis: { focus: 'series' },
          data: dels.map(d => -d), // barras para baixo
        },
        {
          name: t('chart.lines.net'),
          type: 'line',
          smooth: true,
          symbolSize: 6,
          lineStyle: { width: 2.5, color: ct.primary },
          itemStyle: { color: ct.primary },
          data: adds.map((a, i) => a - dels[i]),
        },
      ],
    }
  }

  // acumulado: crescimento líquido do código no período filtrado
  let accAdd = 0
  let accDel = 0
  const cumAdds: number[] = []
  const cumDels: number[] = []
  const cumNet: number[] = []
  for (let i = 0; i < months.length; i++) {
    accAdd += adds[i]
    accDel += dels[i]
    cumAdds.push(accAdd)
    cumDels.push(-accDel)
    cumNet.push(accAdd - accDel)
  }

  return {
    tooltip: tooltipBase({ trigger: 'axis', valueFormatter: (v: unknown) => fmtInt(Number(v)) }),
    legend: { data: [t('chart.lines.netCum'), t('chart.lines.addedCum'), t('chart.lines.removedCum')], textStyle: legendText() },
    grid: { left: 60, right: 20, top: 40, bottom: 60 },
    ...axis,
    series: [
      {
        name: t('chart.lines.addedCum'),
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, type: 'dashed', color: ct.success500 },
        itemStyle: { color: ct.success500 },
        data: cumAdds,
      },
      {
        name: t('chart.lines.removedCum'),
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, type: 'dashed', color: ct.error500 },
        itemStyle: { color: ct.error500 },
        data: cumDels,
      },
      {
        name: t('chart.lines.netCum'),
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2.5, color: ct.primary },
        itemStyle: { color: ct.primary },
        areaStyle: { color: ct.primary, opacity: 0.12 },
        data: cumNet,
      },
    ],
  }
})
</script>

<template>
  <ChartPanel
    :title="mode === 'month' ? t('chart.lines.title') : t('chart.lines.titleCum')"
    :option="option"
    icon="i-lucide-diff"
    tall
  >
    <template #actions>
      <UButton size="xs" :color="mode === 'month' ? 'primary' : 'neutral'" :variant="mode === 'month' ? 'soft' : 'ghost'" :aria-pressed="mode === 'month'" @click="mode = 'month'">
        {{ t('chart.lines.modeMonth') }}
      </UButton>
      <UButton size="xs" :color="mode === 'cumulative' ? 'primary' : 'neutral'" :variant="mode === 'cumulative' ? 'soft' : 'ghost'" :aria-pressed="mode === 'cumulative'" @click="mode = 'cumulative'">
        {{ t('chart.lines.modeCum') }}
      </UButton>
    </template>
  </ChartPanel>
</template>
