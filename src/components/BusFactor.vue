<script setup lang="ts">
import { computed } from 'vue'
import { filteredMonthly } from '../data'
import { reviewShareByRepo } from '../github'
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
  const byRepo = new Map<string, Map<string, number>>()
  for (const r of filteredMonthly.value) {
    if (!byRepo.has(r.repo))
      byRepo.set(r.repo, new Map())
    const m = byRepo.get(r.repo)!
    m.set(r.author, (m.get(r.author) ?? 0) + r.commits)
  }

  const reviews = new Map(reviewShareByRepo.value.map(r => [r.repo, r]))

  return [...byRepo.entries()]
    .map(([repo, m]) => {
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1])
      const total = sorted.reduce((s, [, v]) => s + v, 0)
      const [topAuthor, topCommits] = sorted[0]
      const rev = reviews.get(repo)
      const blindSpot = !!rev && rev.total >= 5 && rev.topShare >= 0.7 && rev.topReviewer === topAuthor
      return {
        repo,
        total,
        devs: sorted.length,
        topAuthor,
        topShare: topCommits / total,
        topReviewer: rev && rev.total >= 3 ? rev.topReviewer : null,
        reviewShare: rev?.topShare ?? 0,
        reviewTotal: rev?.total ?? 0,
        blindSpot,
      }
    })
    .filter(r => r.total >= 10) // ignora repos quase sem atividade no período
    .sort((a, b) => (Number(b.blindSpot) - Number(a.blindSpot)) || (b.topShare - a.topShare))
})

function risk(r: RepoRisk): { color: 'error' | 'warning' | 'success', label: string, hex: string } {
  if ((r.topShare >= 0.7 && r.devs <= 2) || (r.blindSpot && r.topShare >= 0.5))
    return { color: 'error', label: 'alto', hex: 'var(--ui-error)' }
  if (r.topShare >= 0.5)
    return { color: 'warning', label: 'médio', hex: 'var(--ui-warning)' }
  return { color: 'success', label: 'ok', hex: 'var(--ui-success)' }
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
              <div class="h-2 rounded bg-accented overflow-hidden">
                <div class="h-full rounded" :style="{ width: `${Math.round(r.topShare * 100)}%`, background: risk(r).hex }" />
              </div>
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
                <UIcon v-if="r.blindSpot" name="i-lucide-eye-off" class="size-3.5 align-[-2px]" title="o dev principal também domina as reviews" />
              </span>
              <span v-else class="text-dimmed">—</span>
            </td>
            <td class="num">
              <UBadge :color="risk(r).color" variant="soft">
                {{ risk(r).label }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs px-4 pb-3 pt-2.5">
        alto = 1 dev com ≥70% e ≤2 devs ativos, ou dev principal (≥50%) que também faz ≥70% das reviews · médio = 1 dev com ≥50% · repos com &lt;10 commits no período são ignorados
      </p>
    </template>
  </TablePanel>
</template>
