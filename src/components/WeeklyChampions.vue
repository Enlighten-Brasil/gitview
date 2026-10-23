<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { getOrCreate } from '../collections'
import { filteredWeekly, inPeriodMonth, isoWeekKeyBefore, nestBySum } from '../data'
import { fmtRatio } from '../format'

/**
 * Campeão da semana por EVOLUÇÃO (issue #10), não por volume: o volume puro
 * premiava sempre a mesma pessoa (dados reais: 82% das semanas pro mesmo dev)
 * e incentivava commit-splitting. Vitória = maior `commits / (média das 8
 * semanas anteriores + 1)` na semana, com piso de 3 commits para matar o ruído
 * de médias pequenas. O "+1" no denominador dá às 2× a quem começa do zero —
 * quem volta de férias vence uma semana, não o placar inteiro.
 * A janela de baseline é calendário (follow-up #12): as 8 semanas ISO
 * anteriores, com semana vazia contando 0 — antes usava as 8 semanas COM
 * dados, que esticavam além de 8 calendárias em períodos esparsos.
 * Issue #25: a janela só considera semanas DENTRO do período filtrado —
 * semanas anteriores ao início do período não entram na média; semana sem
 * nenhuma semana anterior no período fica de fora do ranking (baseline 0
 * viraria volume puro: 116× na primeira semana de um preset 1M, no probe).
 */
const MIN_WEEK_COMMITS = 3
const BASELINE_WEEKS = 8

const { t } = useI18n({ useScope: 'global' })

const data = computed(() => {
  // semana → autor → commits (agregação compartilhada — issue #41)
  const byWeek = nestBySum(filteredWeekly.value, r => r.week, r => r.author)

  const weeks = [...byWeek.keys()].sort()
  const wins: { week: string, author: string, commits: number, ratio: number }[] = []
  for (let i = 0; i < weeks.length; i++) {
    // janela = as BASELINE_WEEKS semanas calendário anteriores que caem
    // DENTRO do período filtrado (issue #25); chave fora do formato
    // "YYYY-Www" só encurta a janela (não deve ocorrer). Sem nenhuma semana
    // anterior no período, a baseline seria 0 — a semana sai do ranking.
    const window: string[] = []
    for (let k = BASELINE_WEEKS; k >= 1; k--) {
      const wk = isoWeekKeyBefore(weeks[i], k)
      if (wk && inPeriodMonth(wk))
        window.push(wk)
    }
    if (!window.length)
      continue
    let best: { author: string, commits: number, ratio: number } | null = null
    // semana sempre existe no mapa (weeks vem de byWeek.keys()) — getOrCreate dispensa `!`
    for (const [author, commits] of getOrCreate(byWeek, weeks[i], () => new Map<string, number>())) {
      if (commits < MIN_WEEK_COMMITS)
        continue
      const prev = window.reduce((s, w) => s + (byWeek.get(w)?.get(author) ?? 0), 0)
      const ratio = commits / (prev / Math.max(window.length, 1) + 1)
      if (!best || ratio > best.ratio
        || (ratio === best.ratio && (commits > best.commits || (commits === best.commits && author < best.author)))) {
        best = { author, commits, ratio }
      }
    }
    if (best)
      wins.push({ week: weeks[i], ...best })
  }

  // vitórias por dev (todas as semanas do período filtrado)
  const titles = new Map<string, number>()
  for (const w of wins) titles.set(w.author, (titles.get(w.author) ?? 0) + 1)
  const titleRank = [...titles.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author))

  return { recent: wins.slice().reverse().slice(0, 12), titleRank, weeksWithWins: wins.length }
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
