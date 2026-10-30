<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { filteredWeekly, inPeriodMonth } from '../data'
import { fmtRatio } from '../format'
import { BASELINE_WEEKS, MIN_WEEK_COMMITS, weeklyWins } from '../weeklyWinners'

/**
 * Campeão da semana por EVOLUÇÃO (issue #10), não por volume: o volume puro
 * premiava sempre a mesma pessoa (dados reais: 82% das semanas pro mesmo dev)
 * e incentivava commit-splitting. A fórmula vive em `../weeklyWinners` (pura e
 * testada) — este componente só projeta o resultado no período filtrado.
 */
const { t } = useI18n({ useScope: 'global' })

const data = computed(() => {
  const { wins, titleRank, weeksWithWins } = weeklyWins(filteredWeekly.value, { isWeekInPeriod: inPeriodMonth })
  return { recent: wins.slice().reverse().slice(0, 12), titleRank, weeksWithWins }
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-trophy" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">{{ t('chart.weekly.title') }}</span>
      </div>
    </template>

    <div v-if="data.weeksWithWins" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('chart.week') }}</th><th>{{ t('chart.dev') }}</th><th class="num">
              {{ t('chart.weekly.vsAvg') }}
            </th><th class="num">
              {{ t('chart.commits') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="w in data.recent" :key="w.week">
            <td class="text-muted">
              {{ w.week }}
            </td>
            <td>{{ w.author }}</td>
            <td class="num font-semibold text-success">
              {{ t('chart.ratio', { n: fmtRatio(w.ratio) }) }}
            </td>
            <td class="num text-muted">
              {{ w.commits }}
            </td>
          </tr>
        </tbody>
      </table>
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('chart.weekly.wins') }}</th><th class="num">
              <UIcon name="i-lucide-trophy" class="size-3.5 align-[-2px]" />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="rank in data.titleRank" :key="rank.author">
            <td>{{ rank.author }}</td>
            <td class="num">
              <UBadge color="warning" variant="soft">
                {{ rank.count }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="py-6 text-center text-sm text-muted">
      {{ t('chart.weekly.empty', { min: MIN_WEEK_COMMITS }) }}
    </div>

    <p class="text-xs text-dimmed mt-3">
      {{ t('chart.weekly.footnote', { baseline: BASELINE_WEEKS, min: MIN_WEEK_COMMITS }) }}
    </p>
  </UCard>
</template>
