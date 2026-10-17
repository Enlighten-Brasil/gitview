<script setup lang="ts">
import { computed } from 'vue'
import { filteredTotals, filters, previousTotals, rangeLabel, stats } from '../data'

// formato compacto pt-BR: vírgula como separador decimal (igual LinesFlow/WeeklyChampions)
function fmt(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (n >= 10_000)
    return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString('pt-BR')
}

/** delta % vs janela anterior equivalente; null sem base de comparação */
function delta(cur: number, prev: number | undefined) {
  if (prev == null || prev === 0)
    return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { pct: Math.abs(pct), dir: pct > 2 ? 'up' : pct < -2 ? 'down' : 'flat' } as const
}

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
  if (!judge)
    return 'text-dimmed'
  if (dir === 'up')
    return 'text-success'
  if (dir === 'down')
    return 'text-error'
  return 'text-dimmed'
}

/** tooltip do delta — concordância por cardinalidade da janela (1M = singular) */
const deltaTooltip = computed(() => {
  const n = filters.rangeMonths
  if (n == null)
    return 'vs a janela anterior equivalente'
  return n === 1 ? 'vs o mês anterior' : `vs os ${n} meses anteriores`
})

/** totais históricos em linha discreta (contexto, sem duplicar o grid) */
const historyLine = computed(() => {
  const t = stats.value?.totals
  if (!t)
    return ''
  return `histórico total: ${fmt(t.commits)} commits · ${fmt(t.additions)} linhas + · ${fmt(t.deletions)} linhas − · ${t.authors} devs · ${t.repos} repos`
})
</script>

<template>
  <div class="flex flex-col gap-3">
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
            <UTooltip v-if="c.delta" :text="deltaTooltip">
              <span
                class="ml-1 font-semibold"
                :class="deltaClass(c.delta.dir, c.judge)"
              >
                <template v-if="c.delta.dir === 'up'">↑ {{ c.delta.pct }}%</template>
                <template v-else-if="c.delta.dir === 'down'">↓ {{ c.delta.pct }}%</template>
                <template v-else>→ {{ c.delta.pct }}%</template>
              </span>
            </UTooltip>
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
