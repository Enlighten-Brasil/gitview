<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed, ref } from 'vue'
import { axisLabel, ct, legendText, splitLine, tooltipBase } from '../chartTheme'
import { filteredMonthly } from '../data'
import ChartPanel from './ChartPanel.vue'

// fluxo de linhas (+ adicionadas / − removidas) por mês ou acumulado — "andamento" do código
const mode = ref<'month' | 'cumulative'>('month')

/** 2.2M / 350k / 42 (pt-BR) */
function compact(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e6)
    return `${(v / 1e6).toFixed(1).replace('.', ',')}M`
  if (abs >= 1e3)
    return `${Math.round(v / 1e3)}k`
  return String(v)
}

const fmtFull = (v: unknown) => Number(v).toLocaleString('pt-BR')

const option = computed<EChartsOption>(() => {
  const byMonth = new Map<string, { additions: number, deletions: number }>()
  for (const r of filteredMonthly.value) {
    const cur = byMonth.get(r.month) ?? { additions: 0, deletions: 0 }
    cur.additions += r.additions
    cur.deletions += r.deletions
    byMonth.set(r.month, cur)
  }
  const months = [...byMonth.keys()].sort()
  const adds = months.map(m => byMonth.get(m)!.additions)
  const dels = months.map(m => byMonth.get(m)!.deletions)

  const axis = {
    xAxis: { type: 'category', data: months, axisLabel: axisLabel() },
    yAxis: { type: 'value', axisLabel: axisLabel({ formatter: compact }), splitLine: splitLine() },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
  }

  if (mode.value === 'month') {
    return {
      tooltip: tooltipBase({ trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: fmtFull }),
      legend: { data: ['adicionadas', 'removidas', 'saldo'], textStyle: legendText() },
      grid: { left: 60, right: 20, top: 40, bottom: 60 },
      ...axis,
      series: [
        {
          name: 'adicionadas',
          type: 'bar',
          itemStyle: { color: ct.success500 },
          emphasis: { focus: 'series' },
          data: adds,
        },
        {
          name: 'removidas',
          type: 'bar',
          itemStyle: { color: ct.error500 },
          emphasis: { focus: 'series' },
          data: dels.map(d => -d), // barras para baixo
        },
        {
          name: 'saldo',
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
    tooltip: tooltipBase({ trigger: 'axis', valueFormatter: fmtFull }),
    legend: { data: ['saldo acumulado', 'adicionadas acumuladas', 'removidas acumuladas'], textStyle: legendText() },
    grid: { left: 60, right: 20, top: 40, bottom: 60 },
    ...axis,
    series: [
      {
        name: 'adicionadas acumuladas',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, type: 'dashed', color: ct.success500 },
        itemStyle: { color: ct.success500 },
        data: cumAdds,
      },
      {
        name: 'removidas acumuladas',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 1.5, type: 'dashed', color: ct.error500 },
        itemStyle: { color: ct.error500 },
        data: cumDels,
      },
      {
        name: 'saldo acumulado',
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
    :title="mode === 'month' ? 'Linhas adicionadas × removidas por mês' : 'Crescimento líquido do código (acumulado)'"
    :option="option"
    icon="i-lucide-diff"
    tall
  >
    <template #actions>
      <UButton size="xs" :color="mode === 'month' ? 'primary' : 'neutral'" :variant="mode === 'month' ? 'solid' : 'ghost'" @click="mode = 'month'">
        por mês
      </UButton>
      <UButton size="xs" :color="mode === 'cumulative' ? 'primary' : 'neutral'" :variant="mode === 'cumulative' ? 'solid' : 'ghost'" @click="mode = 'cumulative'">
        acumulado
      </UButton>
    </template>
  </ChartPanel>
</template>
