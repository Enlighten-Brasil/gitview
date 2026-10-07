<script setup lang="ts">
import { computed } from 'vue'
import { commitsByAuthor, filteredCommitCount, stats } from '../data'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString('pt-BR')
}

const cards = computed(() => {
  const s = stats.value
  if (!s) return []
  const top = commitsByAuthor.value[0]
  return [
    { value: fmt(filteredCommitCount.value), label: 'commits no período' },
    { value: fmt(s.totals.commits), label: 'commits no histórico' },
    { value: fmt(s.totals.authors), label: 'devs' },
    { value: fmt(s.totals.repos), label: 'repositórios' },
    { value: fmt(s.totals.additions), label: 'linhas adicionadas' },
    { value: fmt(s.totals.deletions), label: 'linhas removidas' },
    ...(top ? [{ value: top.author, label: `mais commits no período (${fmt(top.commits)})` }] : []),
  ]
})
</script>

<template>
  <div class="cards">
    <div v-for="c in cards" :key="c.label" class="card">
      <div class="value">{{ c.value }}</div>
      <div class="label">{{ c.label }}</div>
    </div>
  </div>
</template>
