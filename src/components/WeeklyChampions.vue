<script setup lang="ts">
import { computed } from 'vue'
import { filteredWeekly, isoWeekKeyBefore } from '../data'
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
 */
const MIN_WEEK_COMMITS = 3
const BASELINE_WEEKS = 8

const data = computed(() => {
  const byWeek = new Map<string, Map<string, number>>()
  for (const r of filteredWeekly.value) {
    if (!byWeek.has(r.week))
      byWeek.set(r.week, new Map())
    const m = byWeek.get(r.week)!
    m.set(r.author, (m.get(r.author) ?? 0) + r.commits)
  }

  const weeks = [...byWeek.keys()].sort()
  const wins: { week: string, author: string, commits: number, ratio: number }[] = []
  for (let i = 0; i < weeks.length; i++) {
    // janela = as BASELINE_WEEKS semanas calendário anteriores (vazia = 0);
    // chave fora do formato "YYYY-Www" só encurta a janela (não deve ocorrer)
    const window: string[] = []
    for (let k = BASELINE_WEEKS; k >= 1; k--) {
      const wk = isoWeekKeyBefore(weeks[i], k)
      if (wk)
        window.push(wk)
    }
    let best: { author: string, commits: number, ratio: number } | null = null
    for (const [author, commits] of byWeek.get(weeks[i])!) {
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
        <span class="text-sm font-semibold text-highlighted">Campeão da semana — maior evolução</span>
      </div>
    </template>

    <div v-if="data.weeksWithWins" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <table class="data-table">
        <thead>
          <tr>
            <th>semana</th><th>dev</th><th class="num">
              vs média
            </th><th class="num">
              commits
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
              {{ fmtRatio(w.ratio) }}×
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
            <th>vitórias (período)</th><th class="num">
              🏆
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in data.titleRank" :key="t.author">
            <td>{{ t.author }}</td>
            <td class="num">
              <UBadge color="warning" variant="soft">
                {{ t.count }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="py-6 text-center text-sm text-muted">
      Nenhuma semana com {{ MIN_WEEK_COMMITS }}+ commits no período — sem campeão.
    </div>

    <p class="text-xs text-dimmed mt-3">
      Vitória = maior salto sobre a própria média das {{ BASELINE_WEEKS }} semanas anteriores (commits ÷ (média + 1), mínimo {{ MIN_WEEK_COMMITS }} na semana) — premia ritmo, não volume puro. A média usa as {{ BASELINE_WEEKS }} semanas calendário anteriores dentro do período filtrado (semana vazia conta 0); semanas sem candidato são puladas.
    </p>
  </UCard>
</template>
