<script setup lang="ts">
import { computed } from 'vue'
import { fmtDuration, medianCycleHours, mergedPrs, mergedWithoutReview, openAging, openPrs } from '../github'
import { MERGE_NO_REVIEW_AMBER, MERGE_NO_REVIEW_RED, PR_STALE_DAYS } from '../thresholds'

const cards = computed(() => {
  // mesma janela de PR parado do alerta e do resumo (PR_STALE_DAYS)
  const stale = openAging.value.filter(pr => pr.ageDays >= PR_STALE_DAYS).length
  const drafts = openPrs.value.filter(pr => pr.draft).length
  return [
    {
      value: String(openPrs.value.length),
      label: 'PRs abertos',
      icon: 'i-lucide-git-pull-request',
      sub: drafts ? `${drafts} rascunho${drafts > 1 ? 's' : ''}` : null,
    },
    {
      value: String(stale),
      label: `parados há +${PR_STALE_DAYS} dias`,
      icon: 'i-lucide-hourglass',
      color: stale > 0 ? 'text-warning' : undefined,
      sub: null,
    },
    {
      value: String(mergedPrs.value.length),
      label: 'mergeados no período',
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
      sub: `${mergedWithoutReview.value.count} PRs`,
    },
  ]
})
</script>

<template>
  <div class="pr-cards-grid">
    <div v-for="c in cards" :key="c.label" class="stat-card">
      <div class="flex items-center gap-2">
        <UIcon :name="c.icon" class="size-4" :class="c.color ?? 'text-muted'" />
        <span class="text-2xl font-bold tracking-tight truncate">{{ c.value }}</span>
      </div>
      <div class="text-xs text-muted mt-1">
        {{ c.label }}<span v-if="c.sub" class="text-dimmed"> · {{ c.sub }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pr-cards-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
</style>
