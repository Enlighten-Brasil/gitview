<script setup lang="ts">
import * as echarts from 'echarts/core'
import { ref } from 'vue'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  title: string
  option: EChartsOption
  tall?: boolean
  icon?: string
}>()

const wrap = ref<HTMLElement>()

function exportPng() {
  const dom = wrap.value?.querySelector('[_echarts_instance_]') as HTMLElement | null
  const instance = dom ? echarts.getInstanceByDom(dom) : undefined
  if (!instance) return
  const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0f172a' })
  const a = document.createElement('a')
  a.href = url
  a.download = `gitview-${props.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`
  a.click()
}
</script>

<template>
  <UCard class="mb-4" :ui="{ body: 'p-2 sm:p-2', header: 'py-3 px-4 sm:px-4' }">
    <template #header>
      <div class="flex items-center gap-2 flex-wrap">
        <UIcon v-if="icon" :name="icon" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-highlighted">{{ title }}</span>
        <span class="ml-auto flex items-center gap-1.5">
          <slot name="actions" />
          <UTooltip text="exportar como imagem">
            <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-download" @click="exportPng">
              PNG
            </UButton>
          </UTooltip>
        </span>
      </div>
    </template>
    <div ref="wrap">
      <VChart :option="option" :class="tall ? 'chart-tall' : 'chart'" autoresize />
    </div>
  </UCard>
</template>
