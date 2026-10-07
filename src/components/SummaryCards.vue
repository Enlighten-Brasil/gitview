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
    { value: fmt(filteredCommitCount.value), label: 'commits no período', icon: 'i-lucide-git-commit-horizontal' },
    { value: fmt(s.totals.commits), label: 'commits no histórico', icon: 'i-lucide-history' },
    { value: fmt(s.totals.authors), label: 'devs', icon: 'i-lucide-users' },
    { value: fmt(s.totals.repos), label: 'repositórios', icon: 'i-lucide-git-branch' },
    { value: fmt(s.totals.additions), label: 'linhas adicionadas', icon: 'i-lucide-plus', color: 'text-success' },
    { value: fmt(s.totals.deletions), label: 'linhas removidas', icon: 'i-lucide-minus', color: 'text-error' },
    ...(top ? [{ value: top.author, label: `mais commits no período (${fmt(top.commits)})`, icon: 'i-lucide-crown', color: 'text-primary' }] : []),
  ]
})
</script>

<template>
  <div class="grid gap-3" style="grid-template-columns: repeat(auto-fit, minmax(160px, 1fr))">
    <div v-for="c in cards" :key="c.label" class="stat-card">
      <div class="flex items-center gap-2">
        <UIcon :name="c.icon" class="size-4" :class="c.color ?? 'text-muted'" />
        <span class="text-2xl font-bold tracking-tight truncate">{{ c.value }}</span>
      </div>
      <div class="text-xs text-muted mt-1">{{ c.label }}</div>
    </div>
  </div>
</template>
