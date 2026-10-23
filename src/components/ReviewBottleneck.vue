<script setup lang="ts">
import type { RiskStatus, RiskTier } from '../risk'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { reviewShareByRepo } from '../github'
import { statusOf } from '../risk'
import { REVIEW_BOTTLENECK_AMBER, REVIEW_BOTTLENECK_MIN_REVIEWS, REVIEW_BOTTLENECK_RED } from '../thresholds'
import RiskBar from './RiskBar.vue'

const { t } = useI18n({ useScope: 'global' })

/** repos com volume mínimo de reviews — concentração em 1 pessoa é gargalo de fluxo */
const rows = computed(() =>
  reviewShareByRepo.value.filter(r => r.total >= REVIEW_BOTTLENECK_MIN_REVIEWS),
)

// tiers reativos: o label via t() acompanha a troca de locale sem recriar nada
const RISK_TIERS = computed<RiskTier[]>(() => [
  { at: REVIEW_BOTTLENECK_RED, color: 'error', label: t('ui.risk.bottleneck') },
  { at: REVIEW_BOTTLENECK_AMBER, color: 'warning', label: t('ui.risk.watch') },
  { at: 0, color: 'success', label: t('ui.risk.ok') },
])

function riskStatus(r: { topShare: number }): RiskStatus {
  return statusOf(r.topShare, RISK_TIERS.value)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-check" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">{{ t('ui.reviewBottleneck.title') }}</span>
      </div>
    </template>

    <p v-if="rows.length === 0" class="text-muted text-sm">
      {{ t('ui.reviewBottleneck.empty') }}
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('ui.th.repo') }}</th>
            <th style="width: 34%">
              {{ t('ui.th.concentration') }}
            </th>
            <th>{{ t('ui.th.topReviewer') }}</th>
            <th class="num">
              {{ t('ui.th.reviews') }}
            </th>
            <th class="num">
              {{ t('ui.th.status') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.repo">
            <td class="font-medium">
              {{ r.repo }}
            </td>
            <td>
              <RiskBar :pct="r.topShare" :status="riskStatus(r)" :show-value="true" />
            </td>
            <td>{{ r.topReviewer }}</td>
            <td class="num">
              {{ r.total }}
            </td>
            <td class="num">
              <UBadge :color="riskStatus(r).color" variant="soft">
                {{ riskStatus(r).label }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        {{ t('ui.reviewBottleneck.note', { red: Math.round(REVIEW_BOTTLENECK_RED * 100), amber: Math.round(REVIEW_BOTTLENECK_AMBER * 100), min: REVIEW_BOTTLENECK_MIN_REVIEWS }) }}
      </p>
    </template>
  </UCard>
</template>
