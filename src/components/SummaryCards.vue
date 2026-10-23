<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { filteredMonthly, filteredTotals, filters, isCustomRange, previousTotals, rangeLabel, stats } from '../data'
import { fmtCompact } from '../format'
import { DELTA_FLAT_PCT } from '../thresholds'
import StatCard from './StatCard.vue'

const { t } = useI18n({ useScope: 'global' })

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
  const cur = filteredTotals.value
  const p = previousTotals.value
  const s = scopeSplit.value
  return [
    {
      // workScope 'all': valor composto "X • Y" (produção • progresso); com
      // recorte ativo, o valor é do escopo. O delta usa SEMPRE o mesmo escopo
      // no numerador e no denominador (previousTotals já aplica scopeMatches).
      value: s ? `${fmtCompact(s.prod)} • ${fmtCompact(s.progress)}` : fmtCompact(cur.commits),
      label: s ? t('ui.summaryCards.commitsScope') : t('ui.summaryCards.commits'),
      icon: 'i-lucide-git-commit-horizontal',
      color: undefined,
      delta: cardDelta(cur.commits, p?.commits, true),
    },
    { value: fmtCompact(cur.additions), label: t('ui.summaryCards.linesPlus'), icon: 'i-lucide-plus', color: 'text-success', delta: cardDelta(cur.additions, p?.additions, false) },
    { value: fmtCompact(cur.deletions), label: t('ui.summaryCards.linesMinus'), icon: 'i-lucide-minus', color: 'text-error', delta: cardDelta(cur.deletions, p?.deletions, false) },
    { value: String(cur.authors), label: cur.authors === 1 ? t('ui.summaryCards.devOne') : t('ui.summaryCards.devMany'), icon: 'i-lucide-users', color: undefined, delta: cardDelta(cur.authors, p?.authors, true) },
    { value: String(cur.repos), label: cur.repos === 1 ? t('ui.summaryCards.repoOne') : t('ui.summaryCards.repoMany'), icon: 'i-lucide-git-branch', color: undefined, delta: cardDelta(cur.repos, p?.repos, true) },
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

/**
 * tooltip do delta — só existe para janela comparável (mesma guarda do
 * previousTotals: sem base de comparação não há delta, então o tooltip também
 * fica omitido e nunca promete comparação inexistente). Concordância por
 * cardinalidade da janela (1M = singular).
 */
const deltaTooltip = computed(() => {
  const n = filters.rangeMonths
  if (n == null || isCustomRange())
    return undefined
  return n === 1 ? t('ui.summaryCards.deltaMonth') : t('ui.summaryCards.deltaMonths', { n })
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
  const tot = stats.value?.totals
  if (!tot)
    return ''
  // split histórico produção/progresso (issue #129) — só com dados pós-#119
  const commits = 'prodCommits' in tot
    ? t('ui.summaryCards.historySplit', { commits: fmtCompact(tot.commits), prod: fmtCompact(tot.prodCommits), progress: fmtCompact(tot.progressCommits) })
    : t('ui.summaryCards.historyPlain', { commits: fmtCompact(tot.commits) })
  return `${t('ui.summaryCards.historyPrefix')} ${commits} · ${t('ui.summaryCards.historyAdd', { n: fmtCompact(tot.additions) })} · ${t('ui.summaryCards.historyDel', { n: fmtCompact(tot.deletions) })} · ${t('ui.summaryCards.historyDevs', { n: tot.authors })} · ${t('ui.summaryCards.historyRepos', { n: tot.repos })}`
})
</script>

<template>
  <div class="flex flex-col gap-3">
    <div>
      <div class="cards-label">
        {{ t('ui.summaryCards.period', { range: rangeLabel }) }}
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
