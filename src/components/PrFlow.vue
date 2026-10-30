<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { axisLabel, ct, legendText, splitLine, tooltipBase } from '../chartTheme'
import { lastNWeekKeys } from '../data'
import { fmtDuration, fmtInt } from '../format'
import { authorSelected, ghIsBot, ghName, github, medianCycleHours, mergedPrs, mergedWithoutReview, openPrs, repoSelected } from '../github'
import { weeklyPrFlow } from '../overview'
import ChartPanel from './ChartPanel.vue'

/**
 * Fluxo de entrega (PRs) da Visão geral — "está fluindo?": KPIs do período
 * (abertos agora, merged, cycle time, merge sem review) + sparkline merged ×
 * criados nas últimas WEEKS semanas. Janela fixa intencional (convenção do
 * rodapé): a sparkline não segue o filtro de período — os KPIs seguem.
 */
const WEEKS = 12

const { t } = useI18n({ useScope: 'global' })

const weeks = lastNWeekKeys(WEEKS)

// PRs selecionados pela sidebar (repos/devs/bots) sem corte de período — a
// sparkline é janela fixa; "abertos agora" é "agora" por definição
const selectedPrs = computed(() =>
  (github.value?.prs ?? []).filter(pr => repoSelected(pr.repo) && authorSelected(ghName(pr.author), ghIsBot(pr.author))),
)

const flow = computed(() => weeklyPrFlow(selectedPrs.value, weeks))

const kpis = computed(() => [
  { value: fmtInt(openPrs.value.length), label: t('ui.prFlow.open') },
  { value: fmtInt(mergedPrs.value.length), label: t('ui.prFlow.merged') },
  { value: mergedPrs.value.length ? fmtDuration(medianCycleHours.value) : t('chart.dash'), label: t('ui.prFlow.median') },
  { value: t('ui.pct', { n: mergedWithoutReview.value.pct }), label: t('ui.prFlow.noReview') },
])

const option = computed<EChartsOption>(() => ({
  tooltip: tooltipBase({ trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v: unknown) => fmtInt(Number(v)) }),
  legend: { top: 0, right: 0, textStyle: legendText() },
  grid: { left: 40, right: 20, top: 30, bottom: 24 },
  xAxis: { type: 'category', data: weeks, axisLabel: axisLabel() },
  yAxis: { type: 'value', axisLabel: axisLabel(), splitLine: splitLine() },
  series: [
    {
      name: t('ui.prFlow.seriesMerged'),
      type: 'bar',
      data: flow.value.map(f => f.merged),
      itemStyle: { color: ct.success500 },
      barMaxWidth: 14,
    },
    {
      name: t('ui.prFlow.seriesOpened'),
      type: 'bar',
      data: flow.value.map(f => f.opened),
      itemStyle: { color: ct.warning500 },
      barMaxWidth: 14,
    },
  ],
}))
</script>

<template>
  <ChartPanel :title="t('ui.prFlow.title')" icon="i-lucide-git-pull-request" :option="option">
    <template #pre>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div v-for="k in kpis" :key="k.label">
          <div class="text-lg font-semibold leading-tight">
            {{ k.value }}
          </div>
          <div class="text-xs text-dimmed">
            {{ k.label }}
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <p class="text-xs text-dimmed">
        {{ t('ui.prFlow.footnote', { n: WEEKS }) }}
      </p>
    </template>
  </ChartPanel>
</template>
