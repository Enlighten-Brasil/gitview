<script setup lang="ts">
import type { RiskStatus, RiskTier } from '../risk'
import { computed } from 'vue'
import { reviewShareByRepo } from '../github'
import { statusOf } from '../risk'
import { REVIEW_BOTTLENECK_AMBER, REVIEW_BOTTLENECK_MIN_REVIEWS, REVIEW_BOTTLENECK_RED } from '../thresholds'
import RiskBar from './RiskBar.vue'

/** repos com volume mínimo de reviews — concentração em 1 pessoa é gargalo de fluxo */
const rows = computed(() =>
  reviewShareByRepo.value.filter(r => r.total >= REVIEW_BOTTLENECK_MIN_REVIEWS),
)

const RISK_TIERS: RiskTier[] = [
  { at: REVIEW_BOTTLENECK_RED, color: 'error', label: 'gargalo' },
  { at: REVIEW_BOTTLENECK_AMBER, color: 'warning', label: 'atenção' },
  { at: 0, color: 'success', label: 'ok' },
]

function riskStatus(r: { topShare: number }): RiskStatus {
  return statusOf(r.topShare, RISK_TIERS)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-check" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">Gargalo de review — quem segura os PRs</span>
      </div>
    </template>

    <p v-if="rows.length === 0" class="text-muted text-sm">
      Sem reviews suficientes no período filtrado.
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>repo</th>
            <th style="width: 34%">
              concentração
            </th>
            <th>reviewer principal</th>
            <th class="num">
              reviews
            </th>
            <th class="num">
              status
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
        gargalo = 1 pessoa faz ≥{{ Math.round(REVIEW_BOTTLENECK_RED * 100) }}% das reviews do repo · atenção = ≥{{ Math.round(REVIEW_BOTTLENECK_AMBER * 100) }}% · repos com &lt;{{ REVIEW_BOTTLENECK_MIN_REVIEWS }} reviews no período são ignorados
      </p>
    </template>
  </UCard>
</template>
