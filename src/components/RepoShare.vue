<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { donutBase } from '../chartTheme'
import { commitsByRepo } from '../data'
import ChartPanel from './ChartPanel.vue'

const { t } = useI18n({ useScope: 'global' })

const option = computed<EChartsOption>(() =>
  donutBase(commitsByRepo.value.map(r => ({ name: r.repo, value: r.commits }))),
)
</script>

<template>
  <ChartPanel :title="t('chart.repoShare.title')" :option="option" />
</template>
