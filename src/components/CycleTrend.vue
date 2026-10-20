<script setup lang="ts">
import { computed } from 'vue'
import { fmtDuration } from '../format'
import { cycleTrend, github } from '../github'

interface TrendCell {
  medianHours: number
  count: number
}

/** linha do grid — célula null = mês sem PR mergeado no repo */
interface TrendRow {
  repo: string
  trend: { color: 'error' | 'warning' | 'success', label: string }
  cells: (TrendCell | null)[]
}

function trend(r: { months: { medianHours: number }[], rising: boolean }): TrendRow['trend'] {
  if (r.rising)
    return { color: 'error', label: 'subindo' }
  const last3 = r.months.slice(-3)
  if (last3.length === 3 && last3[0].medianHours > last3[1].medianHours && last3[1].medianHours > last3[2].medianHours) {
    return { color: 'success', label: 'caindo' }
  }
  return { color: 'warning', label: 'estável' }
}

/**
 * Grid pré-composto (issue #42): meses do header (últimos 4 com dados em
 * qualquer repo) × células alinhadas por repo — o template consome
 * `TrendCell | null` direto, sem non-null assertion (fora do typecheck).
 */
const grid = computed(() => {
  const all = new Set<string>()
  for (const r of cycleTrend.value) {
    for (const m of r.months) all.add(m.month)
  }
  const months = [...all].sort().slice(-4)
  const rows = cycleTrend.value.map((r): TrendRow => {
    const byMonth = new Map(r.months.map(m => [m.month, m]))
    return { repo: r.repo, trend: trend(r), cells: months.map(m => byMonth.get(m) ?? null) }
  })
  return { months, rows }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-trending-up" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">Tendência de cycle time — últimos 6 meses</span>
      </div>
    </template>

    <p v-if="!github" class="text-muted text-sm">
      Sem dados do GitHub — rode <code>pnpm collect:github</code>.
    </p>
    <p v-else-if="grid.rows.length === 0" class="text-muted text-sm">
      Poucos PRs mergeados nos últimos 6 meses para medir tendência.
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>repo</th>
            <th v-for="m in grid.months" :key="m" class="num">
              {{ m }}
            </th>
            <th class="num">
              tendência
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in grid.rows" :key="r.repo">
            <td class="font-medium">
              {{ r.repo }}
            </td>
            <td v-for="(cell, i) in r.cells" :key="grid.months[i]" class="num whitespace-nowrap">
              <template v-if="cell">
                {{ fmtDuration(cell.medianHours) }}
                <span class="text-dimmed text-xs">({{ cell.count }})</span>
              </template>
              <span v-else class="text-dimmed">—</span>
            </td>
            <td class="num">
              <UBadge :color="r.trend.color" variant="soft">
                {{ r.trend.label }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        mediana do cycle time (criação → merge) por mês, com (n PRs) · subindo = 3 meses seguidos de alta · ignora o filtro de período e o escopo (github.json não tem o eixo)
      </p>
    </template>
  </UCard>
</template>
