<script setup lang="ts">
import type { RiskLevel, RiskStatus, RiskTier } from '../risk'
import { computed } from 'vue'
import { mergedPrs, mergedWithoutReview } from '../github'
import { statusOf } from '../risk'
import { MERGE_NO_REVIEW_AMBER, MERGE_NO_REVIEW_RED } from '../thresholds'
import RiskBar from './RiskBar.vue'

/** % de PRs mergeados sem review de outra pessoa — threshold: ≥20% vermelho, ≥10% amarelo */
const pct = computed(() => mergedWithoutReview.value.pct)
const count = computed(() => mergedWithoutReview.value.count)
const total = computed(() => mergedPrs.value.length)

const RISK_TIERS: RiskTier[] = [
  { at: MERGE_NO_REVIEW_RED, color: 'error', label: 'alto' },
  { at: MERGE_NO_REVIEW_AMBER, color: 'warning', label: 'atenção' },
  { at: 0, color: 'success', label: 'ok' },
]

const status = computed<RiskStatus>(() => statusOf(pct.value / 100, RISK_TIERS))

/** cor do número grande — literal p/ o Tailwind gerar a classe */
const TEXT_CLASS: Record<RiskLevel, string> = {
  error: 'text-error',
  warning: 'text-warning',
  success: 'text-success',
}
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
        <span class="text-3xl font-bold tracking-tight" :class="TEXT_CLASS[status.color]">
          {{ pct }}%
        </span>
        <span class="text-sm text-muted">{{ count }} de {{ total }} PRs mergeados sem review de outra pessoa</span>
      </div>
      <RiskBar :pct="pct / 100" :status="status" :show-value="false" class="mt-3" />
      <p class="text-dimmed text-xs mt-2.5">
        alto = ≥{{ MERGE_NO_REVIEW_RED * 100 }}% · atenção = ≥{{ MERGE_NO_REVIEW_AMBER * 100 }}% · detalhamento por dev na aba Pull requests
      </p>
    </template>
  </UCard>
</template>
