<script setup lang="ts">
import type { RiskStatus, RiskTier } from '../risk'
import { computed } from 'vue'
import { filteredMonthly, nestBySum } from '../data'
import { reviewShareByRepo } from '../github'
import { statusOf } from '../risk'
import { BUS_FACTOR_BLIND_SPOT_MIN_REVIEWS, BUS_FACTOR_BLIND_SPOT_REVIEW_SHARE, BUS_FACTOR_HIGH_MAX_DEVS, BUS_FACTOR_MIN_COMMITS, BUS_FACTOR_RISK_AMBER, BUS_FACTOR_RISK_RED, BUS_FACTOR_TOP_REVIEWER_MIN_REVIEWS } from '../thresholds'
import RiskBar from './RiskBar.vue'
import TablePanel from './TablePanel.vue'

interface RepoRisk {
  repo: string
  total: number
  devs: number
  topAuthor: string
  topShare: number
  topReviewer: string | null // quem mais revisa no repo (null = sem reviews no período)
  reviewShare: number
  reviewTotal: number
  /** o dev que mais commita também domina as reviews — ponto cego de review */
  blindSpot: boolean
}

/** concentração por repo no período filtrado, cruzada com quem revisa os PRs do repo */
const rows = computed<RepoRisk[]>(() => {
  // repo → autor → commits (agregação compartilhada — issue #41)
  const byRepo = nestBySum(filteredMonthly.value, r => r.repo, r => r.author)

  const reviews = new Map(reviewShareByRepo.value.map(r => [r.repo, r]))

  return [...byRepo.entries()]
    .map(([repo, m]) => {
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1])
      const total = sorted.reduce((s, [, v]) => s + v, 0)
      const [topAuthor, topCommits] = sorted[0]
      const rev = reviews.get(repo)
      const blindSpot = !!rev && rev.total >= BUS_FACTOR_BLIND_SPOT_MIN_REVIEWS && rev.topShare >= BUS_FACTOR_BLIND_SPOT_REVIEW_SHARE && rev.topReviewer === topAuthor
      return {
        repo,
        total,
        devs: sorted.length,
        topAuthor,
        topShare: topCommits / total,
        topReviewer: rev && rev.total >= BUS_FACTOR_TOP_REVIEWER_MIN_REVIEWS ? rev.topReviewer : null,
        reviewShare: rev?.topShare ?? 0,
        reviewTotal: rev?.total ?? 0,
        blindSpot,
      }
    })
    .filter(r => r.total >= BUS_FACTOR_MIN_COMMITS) // ignora repos quase sem atividade no período
    .sort((a, b) => (Number(b.blindSpot) - Number(a.blindSpot)) || (b.topShare - a.topShare))
})

const RISK_TIERS: RiskTier[] = [
  { at: BUS_FACTOR_RISK_RED, color: 'error', label: 'alto' },
  { at: BUS_FACTOR_RISK_AMBER, color: 'warning', label: 'médio' },
  { at: 0, color: 'success', label: 'ok' },
]

/**
 * risco no eixo dos tiers (alto/médio de thresholds.ts): concentração alta só
 * vira "alto" com poucos devs ativos (BUS_FACTOR_HIGH_MAX_DEVS) ou ponto cego
 * de review — fora disso o teto é "médio", preservando a regra do painel
 */
function riskScore(r: RepoRisk): number {
  const high = (r.topShare >= BUS_FACTOR_RISK_RED && r.devs <= BUS_FACTOR_HIGH_MAX_DEVS) || (r.blindSpot && r.topShare >= BUS_FACTOR_RISK_AMBER)
  return high ? BUS_FACTOR_RISK_RED : Math.min(r.topShare, BUS_FACTOR_RISK_AMBER)
}

function riskStatus(r: RepoRisk): RiskStatus {
  return statusOf(riskScore(r), RISK_TIERS)
}
</script>

<template>
  <TablePanel title="Bus factor — concentração por repositório" icon="i-lucide-bus" icon-class="text-error">
    <p v-if="rows.length === 0" class="text-muted text-sm px-4 py-4">
      Sem dados suficientes no período filtrado.
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>repo</th>
            <th style="width: 22%">
              concentração
            </th>
            <th>dev principal</th>
            <th class="num">
              % de 1 dev
            </th>
            <th class="num">
              devs ativos
            </th>
            <th class="num">
              commits
            </th>
            <th>review dominante</th>
            <th class="num">
              risco
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.repo">
            <td class="font-medium">
              {{ r.repo }}
            </td>
            <td>
              <RiskBar :pct="r.topShare" :status="riskStatus(r)" :show-value="false" />
            </td>
            <td>{{ r.topAuthor }}</td>
            <td class="num">
              {{ Math.round(r.topShare * 100) }}%
            </td>
            <td class="num">
              {{ r.devs }}
            </td>
            <td class="num">
              {{ r.total }}
            </td>
            <td>
              <span v-if="r.topReviewer" :class="r.blindSpot ? 'text-error font-medium' : ''">
                {{ r.topReviewer }} · {{ Math.round(r.reviewShare * 100) }}%
                <UTooltip v-if="r.blindSpot" text="o dev principal também domina as reviews">
                  <UIcon name="i-lucide-eye-off" class="size-3.5 align-[-2px]" />
                </UTooltip>
              </span>
              <span v-else class="text-dimmed">—</span>
            </td>
            <td class="num">
              <UBadge :color="riskStatus(r).color" variant="soft">
                {{ riskStatus(r).label }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs px-4 pb-3 pt-2.5">
        alto = 1 dev com ≥{{ Math.round(BUS_FACTOR_RISK_RED * 100) }}% e ≤{{ BUS_FACTOR_HIGH_MAX_DEVS }} devs ativos, ou dev principal (≥{{ Math.round(BUS_FACTOR_RISK_AMBER * 100) }}%) que também faz ≥{{ Math.round(BUS_FACTOR_BLIND_SPOT_REVIEW_SHARE * 100) }}% das reviews · médio = 1 dev com ≥{{ Math.round(BUS_FACTOR_RISK_AMBER * 100) }}% · repos com &lt;{{ BUS_FACTOR_MIN_COMMITS }} commits no período são ignorados
      </p>
    </template>
  </TablePanel>
</template>
