<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsOption } from 'echarts'
import { commitsByRepo } from '../data'

const option = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item', formatter: '{b}: {c} commits ({d}%)' },
  legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: { color: '#9aa3b2' } },
  series: [{
    type: 'pie',
    radius: ['45%', '75%'],
    center: ['40%', '50%'],
    itemStyle: { borderColor: '#171a21', borderWidth: 2 },
    label: { show: false },
    data: commitsByRepo.value.map(r => ({ name: r.repo, value: r.commits })),
  }],
}))
</script>

<template>
  <div class="panel">
    <h2>Distribuição por repositório (período filtrado)</h2>
    <VChart :option="option" class="chart" autoresize />
  </div>
</template>
