<script setup lang="ts">
import type { RiskLevel, RiskStatus, RiskTier } from '../risk'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { mergedPrs, mergedWithoutReview } from '../github'
import { statusOf } from '../risk'
import { MERGE_NO_REVIEW_AMBER, MERGE_NO_REVIEW_RED } from '../thresholds'
import RiskBar from './RiskBar.vue'

const { t } = useI18n({ useScope: 'global' })

/** % de PRs mergeados sem review de outra pessoa — threshold: ≥20% vermelho, ≥10% amarelo */
const pct = computed(() => mergedWithoutReview.value.pct)
const count = computed(() => mergedWithoutReview.value.count)
const total = computed(() => mergedPrs.value.length)

// tiers reativos: o label via t() acompanha a troca de locale sem recriar nada
const RISK_TIERS = computed<RiskTier[]>(() => [
  { at: MERGE_NO_REVIEW_RED, color: 'error', label: t('ui.risk.high') },
  { at: MERGE_NO_REVIEW_AMBER, color: 'warning', label: t('ui.risk.watch') },
  { at: 0, color: 'success', label: t('ui.risk.ok') },
])

const status = computed<RiskStatus>(() => statusOf(pct.value / 100, RISK_TIERS.value))

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
        <span class="text-sm font-semibold text-highlighted">{{ t('ui.reviewCoverage.title') }}</span>
        <UBadge :color="status.color" variant="soft" size="sm" class="ml-auto">
          {{ status.label }}
        </UBadge>
      </div>
    </template>

    <p v-if="total === 0" class="text-muted text-sm">
      {{ t('ui.reviewCoverage.empty') }}
    </p>

    <template v-else>
      <div class="flex items-baseline gap-2">
        <span class="text-3xl font-bold tracking-tight" :class="TEXT_CLASS[status.color]">
          {{ t('ui.pct', { n: pct }) }}
        </span>
        <span class="text-sm text-muted">{{ total === 1 ? t('ui.reviewCoverage.summaryOne', { count, total }) : t('ui.reviewCoverage.summaryMany', { count, total }) }}</span>
      </div>
      <RiskBar :pct="pct / 100" :status="status" :show-value="false" class="mt-3" />
      <p class="text-dimmed text-xs mt-2.5">
        {{ t('ui.reviewCoverage.note', { red: MERGE_NO_REVIEW_RED * 100, amber: MERGE_NO_REVIEW_AMBER * 100 }) }}
      </p>
    </template>
  </UCard>
</template>
