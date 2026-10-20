<script setup lang="ts">
/**
 * Cards de métrica do perfil do dev (issue #41) — commits/linhas no período +
 * totais históricos (sufixo "(total)") + PRs/reviews quando o GitHub foi
 * coletado. O grid é o `StatCards` compartilhado com repos/[name].
 */
import type { MergedPr } from '@/types'
import { computed } from 'vue'
import StatCards from '@/components/StatCards.vue'
import { filters, inPeriodMonth, isCustomRange, scopeMatches, stats } from '@/data'
import { fmtCompact, fmtDuration, fmtRatio, median } from '@/format'
import { ghName, github } from '@/github'
import { isMergedPr } from '@/types'

const props = defineProps<{ dev: string }>()

// com período ativo OU escopo recortado (issue #129), os cards históricos
// ganham o sufixo " (total)": perAuthor (streaks/activeDays/lastCommit) exige
// granularidade de dia que só existe no coletor — impossível recalcular no
// frontend a partir do monthly, então ficam integrais quando workScope ≠ all
const histSuffix = computed(() =>
  (filters.rangeMonths !== null || isCustomRange() || filters.workScope !== 'all' ? ' (total)' : ''),
)

const authorStats = computed(() =>
  stats.value?.perAuthor.find(a => a.author === props.dev) ?? null,
)

// linhas mensais do dev dentro do período e do escopo de trabalho — base dos
// cards de commits/linhas (com "Tudo" + escopo all, inPeriodMonth aceita todos
// os meses, scopeMatches aceita todas as linhas e a soma equivale ao total histórico)
const myMonthly = computed(() =>
  (stats.value?.monthly ?? []).filter(r => r.author === props.dev && inPeriodMonth(r.month) && scopeMatches(r)),
)

// PRs do dev (dados do GitHub, se coletados)
const myPrs = computed(() => (github.value?.prs ?? []).filter(pr => ghName(pr.author) === props.dev))
const myOpen = computed(() => myPrs.value.filter(p => p.state === 'OPEN'))
// mergeados filtrados pelo período (mês do merge) — narrowing: mergedAt garantido
const myMerged = computed(() => myPrs.value.filter((p): p is MergedPr => isMergedPr(p) && inPeriodMonth(p.mergedAt.slice(0, 7))))
const myCycleHours = computed(() =>
  median(myMerged.value.map(p => (new Date(p.mergedAt).getTime() - new Date(p.createdAt).getTime()) / 3_600_000)),
)
/** reviews que o dev FEZ em PRs de outras pessoas — filtradas pelo período */
const myReviews = computed(() => {
  let total = 0
  let approvals = 0
  for (const pr of github.value?.prs ?? []) {
    for (const r of pr.reviews) {
      if (ghName(r.author) !== props.dev || r.author === pr.author)
        continue
      if (!inPeriodMonth(r.submittedAt.slice(0, 7)))
        continue
      total++
      if (r.state === 'APPROVED')
        approvals++
    }
  }
  return { total, approvals }
})

const cards = computed<{ value: string, label: string, icon?: string, color?: string }[]>(() => {
  const a = authorStats.value
  if (!a)
    return []
  let commits = 0
  let additions = 0
  let deletions = 0
  for (const r of myMonthly.value) {
    commits += r.commits
    additions += r.additions
    deletions += r.deletions
  }
  const base = [
    { value: fmtCompact(commits), label: 'commits', icon: 'i-lucide-git-commit-horizontal' },
    { value: fmtCompact(additions), label: 'linhas +', icon: 'i-lucide-plus', color: 'text-success' },
    { value: fmtCompact(deletions), label: 'linhas −', icon: 'i-lucide-minus', color: 'text-error' },
    { value: String(a.activeDays), label: `dias ativos${histSuffix.value}`, icon: 'i-lucide-calendar-check' },
    { value: fmtRatio(a.commits / Math.max(a.activeDays, 1)), label: `commits/dia ativo${histSuffix.value}`, icon: 'i-lucide-zap' },
    { value: `${a.streak} (máx ${a.longestStreak})`, label: `streak${histSuffix.value}`, icon: 'i-lucide-flame' },
    { value: String(a.repos), label: `repositórios${histSuffix.value}`, icon: 'i-lucide-git-branch' },
  ]
  if (github.value) {
    base.push(
      { value: String(myOpen.value.length), label: 'PRs abertos', icon: 'i-lucide-git-pull-request' },
      { value: fmtDuration(myCycleHours.value), label: 'cycle time mediano', icon: 'i-lucide-timer' },
      { value: `${myReviews.value.total} (${myReviews.value.approvals} aprovações)`, label: 'reviews feitas', icon: 'i-lucide-eye' },
    )
  }
  return base
})
</script>

<template>
  <StatCards :cards="cards" />
</template>
