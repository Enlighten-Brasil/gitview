<script setup lang="ts">
import { computed } from 'vue'
import { mergedPrs, mergedWithoutReview } from '../github'

/** % de PRs mergeados sem review de outra pessoa — threshold: ≥20% vermelho, ≥10% amarelo */
const pct = computed(() => mergedWithoutReview.value.pct)
const count = computed(() => mergedWithoutReview.value.count)
const total = computed(() => mergedPrs.value.length)

const status = computed<{ color: 'error' | 'warning' | 'success', label: string }>(() => {
  if (pct.value >= 20)
    return { color: 'error', label: 'alto' }
  if (pct.value >= 10)
    return { color: 'warning', label: 'atenção' }
  return { color: 'success', label: 'ok' }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-shield-alert" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">Merge sem review — período filtrado</span>
        <UBadge :color="status.color" variant="soft" size="sm" class="ml-auto">
          {{ status.label }}
        </UBadge>
      </div>
    </template>

    <p v-if="total === 0" class="text-muted text-sm">
      Nenhum PR mergeado no período filtrado.
    </p>

    <template v-else>
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-bold tracking-tight" :class="pct >= 20 ? 'text-error' : pct >= 10 ? 'text-warning' : 'text-success'">
          {{ pct }}%
        </span>
        <span class="text-sm text-muted">{{ count }} de {{ total }} PRs mergeados sem review de outra pessoa</span>
      </div>
      <div class="h-2 rounded bg-accented overflow-hidden mt-3">
        <div
          class="h-full rounded"
          :style="{ width: `${pct}%`, background: pct >= 20 ? 'var(--ui-error)' : pct >= 10 ? 'var(--ui-warning)' : 'var(--ui-success)' }"
        />
      </div>
      <p class="text-dimmed text-xs mt-2.5">
        alto = ≥20% · atenção = ≥10% · detalhamento por dev na aba Pull requests
      </p>
    </template>
  </UCard>
</template>
