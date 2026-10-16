<script setup lang="ts">
/**
 * Destaque do período (mais commits no filtro atual) — mora em /devs, onde
 * moram as demais métricas por pessoa. Fica fora do grid pra nunca truncar.
 */
import { computed } from 'vue'
import { commitsByAuthor, filteredCommitCount } from '../data'

const top = computed(() => {
  const t = commitsByAuthor.value[0]
  if (!t) return null
  const share = filteredCommitCount.value > 0
    ? Math.round((t.commits / filteredCommitCount.value) * 100)
    : 0
  return { ...t, share }
})

function fmt(n: number): string {
  return n.toLocaleString('pt-BR')
}
</script>

<template>
  <div v-if="top" class="stat-card flex items-center gap-3 py-3!">
    <UIcon name="i-lucide-crown" class="size-5 text-warning shrink-0" />
    <div class="min-w-0">
      <div class="font-bold text-highlighted truncate">
        {{ top.author }}
      </div>
      <div class="text-xs text-muted">
        destaque do período
      </div>
    </div>
    <div class="ml-auto flex items-center gap-2.5 shrink-0">
      <span class="text-lg font-bold text-highlighted">{{ fmt(top.commits) }}</span>
      <UBadge color="primary" variant="soft" size="sm">
        {{ top.share }}% do período
      </UBadge>
    </div>
  </div>
</template>
