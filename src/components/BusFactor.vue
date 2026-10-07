<script setup lang="ts">
import { computed } from 'vue'
import { filteredMonthly } from '../data'

interface RepoRisk {
  repo: string
  total: number
  devs: number
  topAuthor: string
  topShare: number
}

/** concentração por repo no período filtrado */
const rows = computed<RepoRisk[]>(() => {
  const byRepo = new Map<string, Map<string, number>>()
  for (const r of filteredMonthly.value) {
    if (!byRepo.has(r.repo)) byRepo.set(r.repo, new Map())
    const m = byRepo.get(r.repo)!
    m.set(r.author, (m.get(r.author) ?? 0) + r.commits)
  }

  return [...byRepo.entries()]
    .map(([repo, m]) => {
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1])
      const total = sorted.reduce((s, [, v]) => s + v, 0)
      const [topAuthor, topCommits] = sorted[0]
      return { repo, total, devs: sorted.length, topAuthor, topShare: topCommits / total }
    })
    .filter(r => r.total >= 10) // ignora repos quase sem atividade no período
    .sort((a, b) => b.topShare - a.topShare)
})

function risk(r: RepoRisk): { color: 'error' | 'warning' | 'success'; label: string; hex: string } {
  if (r.topShare >= 0.7 && r.devs <= 2) return { color: 'error', label: 'alto', hex: 'var(--ui-error)' }
  if (r.topShare >= 0.5) return { color: 'warning', label: 'médio', hex: 'var(--ui-warning)' }
  return { color: 'success', label: 'ok', hex: 'var(--ui-success)' }
}
</script>

<template>
  <UCard class="mb-4">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-bus" class="size-4 text-error" />
        <span class="text-sm font-semibold text-highlighted">Bus factor — concentração por repositório</span>
      </div>
    </template>

    <p v-if="rows.length === 0" class="text-muted text-sm">
      Sem dados suficientes no período filtrado.
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>repo</th>
            <th style="width: 28%">concentração</th>
            <th>dev principal</th>
            <th class="num">% de 1 dev</th>
            <th class="num">devs ativos</th>
            <th class="num">commits</th>
            <th class="num">risco</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.repo">
            <td class="font-medium">{{ r.repo }}</td>
            <td>
              <div class="h-2 rounded bg-accented overflow-hidden">
                <div class="h-full rounded" :style="{ width: `${Math.round(r.topShare * 100)}%`, background: risk(r).hex }" />
              </div>
            </td>
            <td>{{ r.topAuthor }}</td>
            <td class="num">{{ Math.round(r.topShare * 100) }}%</td>
            <td class="num">{{ r.devs }}</td>
            <td class="num">{{ r.total }}</td>
            <td class="num">
              <UBadge :color="risk(r).color" variant="soft">{{ risk(r).label }}</UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        alto = 1 dev com ≥70% e ≤2 devs ativos · médio = 1 dev com ≥50% · repos com &lt;10 commits no período são ignorados
      </p>
    </template>
  </UCard>
</template>
