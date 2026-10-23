<script setup lang="ts">
import type { RiskStatus, RiskTier } from '../risk'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { filteredTypes, fixByRepo } from '../data'
import { statusOf } from '../risk'
import { FIX_HOTSPOT_AMBER, FIX_HOTSPOT_MIN_COMMITS, FIX_HOTSPOT_RED } from '../thresholds'
import RiskBar from './RiskBar.vue'

const { t } = useI18n({ useScope: 'global' })

interface RepoFix {
  repo: string
  total: number
  fix: number
  fixPct: number
}

/** % de commits fix por repo no período filtrado — fix alto sustentado sugere instabilidade/dívida */
const rows = computed<RepoFix[]>(() => {
  // fix/total por repo (agregação compartilhada com o RepoTable — issue #41)
  const byRepo = fixByRepo(filteredTypes.value)
  return [...byRepo.entries()]
    .map(([repo, v]) => ({ repo, ...v, fixPct: v.total > 0 ? v.fix / v.total : 0 }))
    .filter(r => r.total >= FIX_HOTSPOT_MIN_COMMITS) // ignora repos com amostra pequena
    .sort((a, b) => b.fixPct - a.fixPct)
})

// tiers com o rótulo resolvido por t(): a troca de locale reavalia o badge
const tiers = computed<RiskTier[]>(() => [
  { at: FIX_HOTSPOT_RED, color: 'error', label: t('chart.fix.tierHot') },
  { at: FIX_HOTSPOT_AMBER, color: 'warning', label: t('chart.risk.attention') },
  { at: 0, color: 'success', label: t('chart.risk.ok') },
])

function riskStatus(r: RepoFix): RiskStatus {
  return statusOf(r.fixPct, tiers.value)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-flame" class="size-4 text-error" />
        <span class="text-sm font-semibold text-highlighted">{{ t('chart.fix.title') }}</span>
      </div>
    </template>

    <p v-if="rows.length === 0" class="text-muted text-sm">
      {{ t('chart.noData') }}
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('chart.repo') }}</th>
            <th style="width: 34%">
              {{ t('chart.fix.pctHeader') }}
            </th>
            <th class="num">
              {{ t('chart.fix.fixHeader') }}
            </th>
            <th class="num">
              {{ t('chart.commits') }}
            </th>
            <th class="num">
              {{ t('chart.status') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.repo">
            <td class="font-medium">
              {{ r.repo }}
            </td>
            <td>
              <RiskBar :pct="r.fixPct" :status="riskStatus(r)" :show-value="true" />
            </td>
            <td class="num">
              {{ r.fix }}
            </td>
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
        {{ t('chart.fix.footnote', { red: Math.round(FIX_HOTSPOT_RED * 100), amber: Math.round(FIX_HOTSPOT_AMBER * 100), min: FIX_HOTSPOT_MIN_COMMITS }) }}
      </p>
    </template>
  </UCard>
</template>
