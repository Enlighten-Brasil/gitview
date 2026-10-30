<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { Exposed as VChartExposed } from 'vue-echarts'
import { useToast } from '@nuxt/ui/composables'
import { computed, ref } from 'vue'
import VChart from 'vue-echarts'
import { useI18n } from 'vue-i18n'
import { ct } from '../chartTheme'
import '../echarts' // registro dos charts/renderers (side-effect) — chunk só das rotas com gráfico

const props = defineProps<{
  title: string
  option: EChartsOption
  tall?: boolean
  icon?: string
  /** força o empty state (a detecção de série vazia já cobre a maioria dos casos) */
  empty?: boolean
  /** texto do empty state */
  emptyText?: string
}>()

const toast = useToast()
const { t } = useI18n({ useScope: 'global' })
// ref do VChart: a instância sai da API exposta do vue-echarts — nada de
// introspecção de DOM (`[_echarts_instance_]` + echarts.getInstanceByDom)
const vchart = ref<VChartExposed | null>(null)

/** série vazia = sem series ou todas sem dados — antes o gráfico "carregava" pra sempre */
const isEmpty = computed(() => {
  if (props.empty)
    return true
  const series = props.option.series
  const list = Array.isArray(series) ? series : series ? [series] : []
  if (list.length === 0)
    return true
  return list.every((s) => {
    const data = (s as { data?: unknown[] }).data
    return !Array.isArray(data) || data.length === 0
  })
})

function exportPng() {
  const instance = vchart.value?.chart
  if (!instance) {
    toast.add({ title: t('chart.export.failTitle'), description: t('chart.export.failDesc'), color: 'error' })
    return
  }
  try {
    const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: ct.bg })
    const a = document.createElement('a')
    a.href = url
    // normaliza acentos (NFD) antes de sanitizar — senão "Frequência" viraria "frequ-ncia"
    const slug = props.title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    a.download = `gitview-${slug}.png`
    a.click()
    toast.add({ title: t('chart.export.doneTitle'), description: `gitview-${slug}.png`, color: 'success' })
  }
  catch (err) {
    // `instanceof` cobre erro sem `message` (o `??` sobre `.message` tipado como
    // string é sempre falso pro Codacy e mascararia o valor jogado)
    const msg = err instanceof Error ? err.message : String(err)
    toast.add({ title: t('chart.export.failTitle'), description: msg, color: 'error' })
  }
}
</script>

<template>
  <UCard :ui="{ body: 'p-2 sm:p-2', header: 'py-3 px-4 sm:px-4' }">
    <template #header>
      <div class="flex items-center gap-2 flex-wrap">
        <UIcon v-if="icon" :name="icon" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-highlighted">{{ title }}</span>
        <span class="ml-auto flex items-center gap-1.5">
          <slot name="actions" />
          <UTooltip v-if="!isEmpty" :text="t('chart.export.tooltip')">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-download" @click="exportPng">
              {{ t('chart.export.png') }}
            </UButton>
          </UTooltip>
        </span>
      </div>
    </template>
    <!-- faixa opcional acima/abaixo do gráfico (ex.: KPIs do fluxo de PRs) -->
    <div v-if="$slots.pre" class="px-2 pb-2">
      <slot name="pre" />
    </div>
    <VChart v-if="!isEmpty" ref="vchart" :option="option" :class="tall ? 'chart-tall' : 'chart'" autoresize />
    <!-- empty state: sem dados o gráfico vazio parecia "carregando" pra sempre -->
    <div v-else :class="tall ? 'chart-tall' : 'chart'" class="flex items-center justify-center text-muted text-sm">
      {{ emptyText ?? t('chart.empty') }}
    </div>
    <div v-if="$slots.footer" class="px-2 pt-1">
      <slot name="footer" />
    </div>
  </UCard>
</template>
