<script setup lang="ts">
import * as echarts from 'echarts/core'
import { ref } from 'vue'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  title: string
  option: EChartsOption
  tall?: boolean
}>()

const wrap = ref<HTMLElement>()

function exportPng() {
  const dom = wrap.value?.querySelector('[_echarts_instance_]') as HTMLElement | null
  const instance = dom ? echarts.getInstanceByDom(dom) : undefined
  if (!instance) return
  const url = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#171a21' })
  const a = document.createElement('a')
  a.href = url
  a.download = `gitview-${props.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.png`
  a.click()
}
</script>

<template>
  <div class="panel">
    <h2>
      {{ title }}
      <span class="panel-actions">
        <slot name="actions" />
        <button class="range-btn" title="exportar como imagem" @click="exportPng">⬇ PNG</button>
      </span>
    </h2>
    <div ref="wrap">
      <VChart :option="option" :class="tall ? 'chart-tall' : 'chart'" autoresize />
    </div>
  </div>
</template>

<style scoped>
.panel-actions {
  float: right;
  display: inline-flex;
  gap: 6px;
}
</style>
