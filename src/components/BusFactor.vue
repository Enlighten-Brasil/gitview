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

function risk(r: RepoRisk): { icon: string; color: string } {
  if (r.topShare >= 0.7 && r.devs <= 2) return { icon: '🔴', color: '#f87171' }
  if (r.topShare >= 0.5) return { icon: '🟡', color: '#facc15' }
  return { icon: '🟢', color: '#4ade80' }
}
</script>

<template>
  <div class="panel">
    <h2>Bus factor — concentração por repositório 🚌</h2>

    <p v-if="rows.length === 0" style="color: var(--text-dim); font-size: 13px">
      Sem dados suficientes no período filtrado.
    </p>

    <table v-else>
      <thead>
        <tr>
          <th>repo</th>
          <th style="width: 32%">concentração</th>
          <th>dev principal</th>
          <th class="num">% de 1 dev</th>
          <th class="num">devs ativos</th>
          <th class="num">commits</th>
          <th class="num">risco</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in rows" :key="r.repo">
          <td>{{ r.repo }}</td>
          <td>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: `${Math.round(r.topShare * 100)}%`, background: risk(r).color }" />
            </div>
          </td>
          <td>{{ r.topAuthor }}</td>
          <td class="num">{{ Math.round(r.topShare * 100) }}%</td>
          <td class="num">{{ r.devs }}</td>
          <td class="num">{{ r.total }}</td>
          <td class="num">{{ risk(r).icon }}</td>
        </tr>
      </tbody>
    </table>

    <p style="color: var(--text-dim); font-size: 12px; margin: 10px 0 0">
      🔴 1 dev com ≥70% e ≤2 devs ativos · 🟡 1 dev com ≥50% · repos com &lt;10 commits no período são ignorados
    </p>
  </div>
</template>

<style scoped>
.bar-track {
  background: #10131a;
  border-radius: 4px;
  height: 8px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 4px;
}
</style>
