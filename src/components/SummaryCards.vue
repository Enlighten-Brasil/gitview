<script setup lang="ts">
import { computed } from 'vue'
import { commitsByAuthor, filteredCommitCount, filteredTotals, previousTotals, rangeLabel, stats } from '../data'

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString('pt-BR')
}

/** delta % vs janela anterior equivalente; null sem base de comparação */
function delta(cur: number, prev: number | undefined) {
  if (prev == null || prev === 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { pct: Math.abs(pct), dir: pct > 2 ? 'up' : pct < -2 ? 'down' : 'flat' } as const
}

/** destaque do período — fica fora do grid pra nunca truncar o nome */
const top = computed(() => {
  const t = commitsByAuthor.value[0]
  if (!t) return null
  const share = filteredCommitCount.value > 0
    ? Math.round((t.commits / filteredCommitCount.value) * 100)
    : 0
  return { ...t, share }
})

const periodCards = computed(() => {
  const t = filteredTotals.value
  const p = previousTotals.value
  return [
    { value: fmt(t.commits), label: 'commits', icon: 'i-lucide-git-commit-horizontal', delta: delta(t.commits, p?.commits), judge: true },
    { value: fmt(t.additions), label: 'linhas +', icon: 'i-lucide-plus', color: 'text-success', delta: delta(t.additions, p?.additions), judge: false },
    { value: fmt(t.deletions), label: 'linhas −', icon: 'i-lucide-minus', color: 'text-error', delta: delta(t.deletions, p?.deletions), judge: false },
    { value: String(t.authors), label: 'devs ativos', icon: 'i-lucide-users', delta: delta(t.authors, p?.authors), judge: true },
    { value: String(t.repos), label: 'repos ativos', icon: 'i-lucide-git-branch', delta: delta(t.repos, p?.repos), judge: true },
  ]
})

/** cor do delta: commits/devs/repos sobem = bom; linhas +/- são neutras */
function deltaClass(dir: 'up' | 'down' | 'flat', judge: boolean): string {
  if (!judge) return 'text-dimmed'
  if (dir === 'up') return 'text-success'
  if (dir === 'down') return 'text-error'
  return 'text-dimmed'
}

/** totais históricos em linha discreta (contexto, sem duplicar o grid) */
const historyLine = computed(() => {
  const t = stats.value?.totals
  if (!t) return ''
  return `histórico total: ${fmt(t.commits)} commits · ${fmt(t.additions)} linhas + · ${fmt(t.deletions)} linhas − · ${t.authors} devs · ${t.repos} repos`
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="top" class="stat-card flex items-center gap-3 py-3!">
      <UIcon name="i-lucide-crown" class="size-5 text-warning shrink-0" />
      <div class="min-w-0">
        <div class="font-bold text-highlighted truncate">
          {{ top.author }}
        </div>
        <div class="text-xs text-muted">
          destaque do período
        </div>
      </div>
      <div class="ml-auto flex items-center gap-2.5 shrink-0">
        <span class="text-lg font-bold text-highlighted">{{ fmt(top.commits) }}</span>
        <UBadge color="primary" variant="soft" size="sm">
          {{ top.share }}% do período
        </UBadge>
      </div>
    </div>

    <div>
      <div class="cards-label">
        no período · {{ rangeLabel }}
      </div>
      <div class="cards-grid">
        <div v-for="c in periodCards" :key="c.label" class="stat-card">
          <div class="flex items-center gap-2">
            <UIcon :name="c.icon" class="size-4" :class="c.color ?? 'text-muted'" />
            <span class="text-2xl font-bold tracking-tight truncate">{{ c.value }}</span>
          </div>
          <div class="text-xs text-muted mt-1">
            {{ c.label }}
            <span
              v-if="c.delta"
              class="ml-1 font-semibold"
              :class="deltaClass(c.delta.dir, c.judge)"
              :title="`vs ${rangeLabel.replace('últimos', 'os').replace('último', 'o')} anteriores`"
            >
              <template v-if="c.delta.dir === 'up'">↑ {{ c.delta.pct }}%</template>
              <template v-else-if="c.delta.dir === 'down'">↓ {{ c.delta.pct }}%</template>
              <template v-else>→ 0%</template>
            </span>
          </div>
        </div>
      </div>
      <div class="text-xs text-dimmed mt-2">
        {{ historyLine }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.cards-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ui-text-dimmed);
  margin-bottom: 6px;
}

.cards-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
</style>
