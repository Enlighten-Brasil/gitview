<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { donutBase } from '../chartTheme'
import { commitsByRepo } from '../data'
import ChartPanel from './ChartPanel.vue'

const option = computed<EChartsOption>(() =>
  donutBase(commitsByRepo.value.map(r => ({ name: r.repo, value: r.commits }))),
)
</script>

<template>
  <ChartPanel title="Distribuição por repositório (período filtrado)" :option="option" />
</template>
