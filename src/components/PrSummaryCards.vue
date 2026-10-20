<script setup lang="ts">
import { computed } from 'vue'
import { fmtDuration } from '../format'
import { medianCycleHours, mergedPrs, mergedWithoutReview, openAging, openPrs } from '../github'
import { MERGE_NO_REVIEW_AMBER, MERGE_NO_REVIEW_RED, PR_STALE_DAYS } from '../thresholds'
import StatCard from './StatCard.vue'

const cards = computed(() => {
  // mesma janela de PR parado do alerta e do resumo (PR_STALE_DAYS)
  const stale = openAging.value.filter(pr => pr.ageDays >= PR_STALE_DAYS).length
  const drafts = openPrs.value.filter(pr => pr.draft).length
  const n = mergedWithoutReview.value.count
  return [
    {
      value: String(openPrs.value.length),
      label: openPrs.value.length === 1 ? 'PR aberto' : 'PRs abertos',
      icon: 'i-lucide-git-pull-request',
      sub: drafts ? `${drafts} rascunho${drafts > 1 ? 's' : ''}` : null,
    },
    {
      value: String(stale),
      // singular na frase do AlertStrip (mesmo threshold, mesma concordância)
      label: stale === 1 ? `PR parado há ${PR_STALE_DAYS}+ dias` : `parados há +${PR_STALE_DAYS} dias`,
      icon: 'i-lucide-hourglass',
      color: stale > 0 ? 'text-warning' : undefined,
      sub: null,
    },
    {
      value: String(mergedPrs.value.length),
      label: mergedPrs.value.length === 1 ? 'mergeado no período' : 'mergeados no período',
      icon: 'i-lucide-git-merge',
      sub: null,
    },
    {
      value: fmtDuration(medianCycleHours.value),
      label: 'cycle time mediano',
      icon: 'i-lucide-timer',
      sub: null,
    },
    {
      value: `${mergedWithoutReview.value.pct}%`,
      label: 'mergeados sem review',
      icon: 'i-lucide-eye-off',
      // mesmos limiares do ReviewCoverage: red ≥20%, amber ≥10%
      color: mergedWithoutReview.value.pct >= MERGE_NO_REVIEW_RED * 100
        ? 'text-error'
        : mergedWithoutReview.value.pct >= MERGE_NO_REVIEW_AMBER * 100
          ? 'text-warning'
          : undefined,
      sub: `${n} ${n === 1 ? 'PR' : 'PRs'}`,
    },
  ]
})
</script>

<template>
  <div class="cards-grid">
    <StatCard
      v-for="c in cards"
      :key="c.label"
      :value="c.value"
      :label="c.label"
      :icon="c.icon"
      :color="c.color"
      :sub="c.sub ?? undefined"
    />
  </div>
</template>
