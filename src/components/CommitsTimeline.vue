<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed, ref } from 'vue'
import { nestBySum } from '../aggregations'
import { axisLabel, legendText, PALETTE, splitLine, tooltipBase } from '../chartTheme'
import { filteredMonthly, filteredWeekly, inPeriodMonth, stats } from '../data'
import ChartPanel from './ChartPanel.vue'

/**
 * Timeline de commits por dev. Sem `author`, é o painel do dashboard (linhas já
 * filtradas pelo store, série por dev); com `author` (perfil do dev, issue #41)
 * corta só as linhas desse autor por período — a mesma regra dos cards.
 */
const props = defineProps<{ author?: string }>()

const granularity = ref<'week' | 'month'>('week')

// linhas normalizadas para o eixo — o perfil ignora a seleção de repo/autores
// do dashboard (a rota /devs/:name só tem filtro de período)
const rows = computed(() => {
  if (props.author) {
    return granularity.value === 'week'
      ? (stats.value?.weekly ?? [])
          .filter(r => r.author === props.author && inPeriodMonth(r.week))
          .map(r => ({ author: r.author, period: r.week, commits: r.commits }))
      : (stats.value?.monthly ?? [])
          .filter(r => r.author === props.author && inPeriodMonth(r.month))
          .map(r => ({ author: r.author, period: r.month, commits: r.commits }))
  }
  return granularity.value === 'week'
    ? filteredWeekly.value.map(r => ({ author: r.author, period: r.week, commits: r.commits }))
    : filteredMonthly.value.map(r => ({ author: r.author, period: r.month, commits: r.commits }))
})

const option = computed<EChartsOption>(() => {
  const periods = [...new Set(rows.value.map(r => r.period))].sort()
  const byAuthor = nestBySum(rows.value, r => r.author, r => r.period)
  const authors = [...byAuthor.keys()].sort()

  const series = authors.map(author => ({
    name: author,
    type: 'bar' as const,
    stack: 'commits',
    emphasis: { focus: 'series' as const },
    data: periods.map(p => byAuthor.get(author)!.get(p) ?? 0),
  }))

  return {
    color: PALETTE,
    tooltip: tooltipBase({ trigger: 'axis', axisPointer: { type: 'shadow' } }),
    // perfil do dev: autor único, legenda dispensável
    legend: props.author ? undefined : { type: 'scroll', textStyle: legendText() },
    grid: { left: 50, right: 20, top: props.author ? 20 : 40, bottom: 60 },
    xAxis: { type: 'category', data: periods, axisLabel: axisLabel() },
    yAxis: { type: 'value', axisLabel: axisLabel(), splitLine: splitLine() },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    series,
  }
})
</script>

<template>
  <ChartPanel
    :title="`Commits por ${granularity === 'week' ? 'semana' : 'mês'}${author ? '' : ' (por dev)'}`"
    :option="option"
    icon="i-lucide-chart-column-stacked"
    :tall="!author"
  >
    <template #actions>
      <UButton size="xs" :color="granularity === 'week' ? 'primary' : 'neutral'" :variant="granularity === 'week' ? 'soft' : 'ghost'" :aria-pressed="granularity === 'week'" @click="granularity = 'week'">
        semana
      </UButton>
      <UButton size="xs" :color="granularity === 'month' ? 'primary' : 'neutral'" :variant="granularity === 'month' ? 'soft' : 'ghost'" :aria-pressed="granularity === 'month'" @click="granularity = 'month'">
        mês
      </UButton>
    </template>
  </ChartPanel>
</template>
