<script setup lang="ts">
import { computed } from 'vue'
import { filteredMonthly, filteredTotals, filters, previousTotals, rangeLabel, stats } from '../data'
import { fmtCompact } from '../format'
import { DELTA_FLAT_PCT } from '../thresholds'
import StatCard from './StatCard.vue'

/** delta % vs janela anterior equivalente; null sem base de comparação */
function delta(cur: number, prev: number | undefined) {
  if (prev == null || prev === 0)
    return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { pct: Math.abs(pct), dir: pct > DELTA_FLAT_PCT ? 'up' : pct < -DELTA_FLAT_PCT ? 'down' : 'flat' } as const
}

/**
 * Split produção/progresso do card de commits (issue #129) — só com
 * workScope 'all' (nos recortes o valor já é de um escopo só) e dados pós-#119
 * (feature-detect do totals.prodCommits, o mesmo dos chips da FilterBar).
 * Derivado do filteredMonthly (janela do período, não o histórico) agrupando
 * pela presença do `scope` da linha (codificação omit-prod): sem scope =
 * produção. Soma fecha com o total do card (prod + progress == commits).
 * Limitação conhecida: squash/cherry-pick pode contar o mesmo trabalho duas
 * vezes (hash novo em produção + hash original em progresso).
 */
const scopeSplit = computed(() => {
  if (filters.workScope !== 'all' || !stats.value || !('prodCommits' in stats.value.totals))
    return null
  let prod = 0
  let progress = 0
  for (const r of filteredMonthly.value) {
    if (r.scope)
      progress += r.commits
    else
      prod += r.commits
  }
  return { prod, progress }
})

const periodCards = computed(() => {
  const t = filteredTotals.value
  const p = previousTotals.value
  const s = scopeSplit.value
  return [
    {
      // workScope 'all': valor composto "X • Y" (produção • progresso); com
      // recorte ativo, o valor é do escopo. O delta usa SEMPRE o mesmo escopo
      // no numerador e no denominador (previousTotals já aplica scopeMatches).
      value: s ? `${fmtCompact(s.prod)} • ${fmtCompact(s.progress)}` : fmtCompact(t.commits),
      label: s ? 'em produção • em progresso' : 'commits',
      icon: 'i-lucide-git-commit-horizontal',
      color: undefined,
      delta: cardDelta(t.commits, p?.commits, true),
    },
    { value: fmtCompact(t.additions), label: 'linhas +', icon: 'i-lucide-plus', color: 'text-success', delta: cardDelta(t.additions, p?.additions, false) },
    { value: fmtCompact(t.deletions), label: 'linhas −', icon: 'i-lucide-minus', color: 'text-error', delta: cardDelta(t.deletions, p?.deletions, false) },
    { value: String(t.authors), label: t.authors === 1 ? 'dev ativo' : 'devs ativos', icon: 'i-lucide-users', color: undefined, delta: cardDelta(t.authors, p?.authors, true) },
    { value: String(t.repos), label: t.repos === 1 ? 'repo ativo' : 'repos ativos', icon: 'i-lucide-git-branch', color: undefined, delta: cardDelta(t.repos, p?.repos, true) },
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

/** delta pronto pro StatCard — cor pela regra `judge` + tooltip da janela */
function cardDelta(cur: number, prev: number | undefined, judge: boolean) {
  const d = delta(cur, prev)
  if (!d)
    return undefined
  return { ...d, class: deltaClass(d.dir, judge), tooltip: deltaTooltip.value }
}

/** totais históricos em linha discreta (contexto, sem duplicar o grid) */
const historyLine = computed(() => {
  const t = stats.value?.totals
  if (!t)
    return ''
  // split histórico produção/progresso (issue #129) — só com dados pós-#119
  const commits = 'prodCommits' in t
    ? `${fmtCompact(t.commits)} commits (${fmtCompact(t.prodCommits)} em produção · ${fmtCompact(t.progressCommits)} em progresso)`
    : `${fmtCompact(t.commits)} commits`
  return `histórico total: ${commits} · ${fmtCompact(t.additions)} linhas + · ${fmtCompact(t.deletions)} linhas − · ${t.authors} devs · ${t.repos} repos`
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <div class="cards-label">
        no período · {{ rangeLabel }}
      </div>
      <div class="cards-grid">
        <StatCard
          v-for="c in periodCards"
          :key="c.label"
          :value="c.value"
          :label="c.label"
          :icon="c.icon"
          :color="c.color"
          :delta="c.delta"
        />
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
</style>
