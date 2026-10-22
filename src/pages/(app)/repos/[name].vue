<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { MergedPr } from '@/types'
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { axisLabel, ct, donutBase, splitLine, tooltipBase } from '@/chartTheme'
import { commitTypeColor, commitTypeGroup } from '@/commitTypes'
import ChartPanel from '@/components/ChartPanel.vue'
import CommitGraph from '@/components/CommitGraph.vue'
import DetailHeader from '@/components/DetailHeader.vue'
import StatCards from '@/components/StatCards.vue'
import TablePanel from '@/components/TablePanel.vue'
import { commitsByAuthorPeriod, filters, groupBySum, inPeriodMonth, isBot, isCustomRange, scopeMatches, stats } from '@/data'
import { fmtCompact, fmtDate, fmtDuration, median } from '@/format'
import { ghIsBot, github } from '@/github'
import { daysSinceLastRelease, lastTagLabel, loadReleases, releases, repoRelease } from '@/releases'
import { DEV_SHARE_AMBER, DEV_SHARE_RED, UNRELEASED_AMBER, UNRELEASED_RED } from '@/thresholds'
import { isMergedPr } from '@/types'

// rota de detalhe do repo (era /repo/:name — alias mantém os links antigos)
definePage({
  alias: '/repo/:name',
  meta: {
    section: 'repos',
    filters: 'period-bots',
  },
})

const route = useRoute()
const repo = computed(() => String(route.params.name ?? ''))

onMounted(loadReleases)

const repoStats = computed(() =>
  stats.value?.perRepo.find(r => r.repo === repo.value) ?? null,
)

const rel = computed(() => repoRelease(repo.value))

// o período se aplica nesta página: com preset/range ativo, commits, gráficos e
// PRs mergeados ficam restritos ao período; "Tudo" = histórico completo.
// releases e PRs abertos são marcos/estado atual e ficam de fora do período.
const periodFiltered = computed(() => filters.rangeMonths !== null || isCustomRange())
// escopo de trabalho ativo (issue #129): os cards de período seguem o recorte;
// os históricos (perRepo/streaks) não têm como seguir e ganham o sufixo
const scopeFiltered = computed(() => filters.workScope !== 'all')
// sufixo dos cards que seguem históricos mesmo com período/escopo ativos
const histSuffix = computed(() => (periodFiltered.value || scopeFiltered.value ? ' (total)' : ''))

// linhas mensais do repo dentro do período, respeitando o switch de bots e o
// escopo de trabalho (com "Tudo", inPeriodMonth aceita todos os meses e a soma
// equivale ao total histórico)
const periodMonthly = computed(() =>
  (stats.value?.monthly ?? []).filter(r =>
    r.repo === repo.value
    && (filters.showBots || !isBot(r.author))
    && inPeriodMonth(r.month)
    && scopeMatches(r),
  ),
)
const periodCommits = computed(() => periodMonthly.value.reduce((s, r) => s + r.commits, 0))
const periodAdds = computed(() => periodMonthly.value.reduce((s, r) => s + r.additions, 0))
const periodDels = computed(() => periodMonthly.value.reduce((s, r) => s + r.deletions, 0))
const periodAuthors = computed(() => new Set(periodMonthly.value.map(r => r.author)).size)

// ---------------------------------------------------------------------------
// PRs do repo (dados do GitHub, se coletados) — o switch de bots vale aqui também
// ---------------------------------------------------------------------------
const repoPrs = computed(() =>
  (github.value?.prs ?? []).filter(p => p.repo === repo.value && (filters.showBots || !ghIsBot(p.author))),
)
const openPrs = computed(() => repoPrs.value.filter(p => p.state === 'OPEN'))
// mergeados filtrados pelo período (mês do merge) — narrowing: mergedAt garantido
const mergedPrs = computed(() =>
  repoPrs.value.filter((p): p is MergedPr => isMergedPr(p) && inPeriodMonth(p.mergedAt.slice(0, 7))),
)
const cycleHours = computed(() =>
  median(mergedPrs.value.map(p => (new Date(p.mergedAt).getTime() - new Date(p.createdAt).getTime()) / 3_600_000)),
)

/** commits por dev no período (ranking + bus factor) — agregação compartilhada (issue #41) */
const devsByCommits = computed(() => commitsByAuthorPeriod(periodMonthly.value))

const topDev = computed(() => {
  const total = devsByCommits.value.reduce((s, d) => s + d.commits, 0)
  const top = devsByCommits.value[0]
  return top && total > 0 ? { author: top.author, share: top.commits / total } : null
})

const cards = computed<{ value: string, label: string, icon?: string, color?: string }[]>(() => {
  const r = repoStats.value
  if (!r)
    return []
  const days = daysSinceLastRelease(repo.value)
  const base = [
    { value: fmtCompact(periodCommits.value), label: 'commits', icon: 'i-lucide-git-commit-horizontal' },
    { value: fmtCompact(periodAdds.value), label: 'linhas +', icon: 'i-lucide-plus', color: 'text-success' },
    { value: fmtCompact(periodDels.value), label: 'linhas −', icon: 'i-lucide-minus', color: 'text-error' },
    { value: String(periodAuthors.value), label: periodAuthors.value === 1 ? 'dev' : 'devs', icon: 'i-lucide-users' },
  ]
  // com período/escopo ativos, mostra também o total histórico pra referência
  if (periodFiltered.value || scopeFiltered.value) {
    base.push({ value: fmtCompact(r.commits), label: `commits${histSuffix.value}`, icon: 'i-lucide-infinity' })
  }
  if (rel.value) {
    base.push(
      {
        value: lastTagLabel(repo.value) ?? '—',
        label: days != null ? `última release (há ${days}d)` : 'última release',
        icon: 'i-lucide-tag',
      },
      {
        value: String(rel.value.unreleased),
        label: rel.value.unreleased === 1 ? 'commit não liberado' : 'commits não liberados',
        icon: 'i-lucide-package-open',
        color: rel.value.unreleased >= UNRELEASED_RED ? 'text-error' : rel.value.unreleased >= UNRELEASED_AMBER ? 'text-warning' : undefined,
      },
    )
  }
  if (topDev.value) {
    base.push({
      value: `${topDev.value.author.split(' ')[0]} (${Math.round(topDev.value.share * 100)}%)`,
      label: 'dev principal',
      icon: 'i-lucide-bus',
      color: topDev.value.share >= DEV_SHARE_RED ? 'text-error' : topDev.value.share >= DEV_SHARE_AMBER ? 'text-warning' : undefined,
    })
  }
  if (github.value) {
    base.push(
      { value: String(openPrs.value.length), label: openPrs.value.length === 1 ? 'PR aberto' : 'PRs abertos', icon: 'i-lucide-git-pull-request' },
      { value: fmtDuration(cycleHours.value), label: 'cycle time mediano (PRs do mês)', icon: 'i-lucide-timer' },
    )
  }
  return base
})

// ---------------------------------------------------------------------------
// gráficos: tipos de commit + commits por dev
// ---------------------------------------------------------------------------
const typesOption = computed<EChartsOption>(() => {
  // tipo agrupado → commits no período (agregação compartilhada — issue #41);
  // segue o switch de bots e o escopo de trabalho (issue #129)
  const map = groupBySum(
    (stats.value?.monthlyTypes ?? []).filter(r =>
      r.repo === repo.value && inPeriodMonth(r.month) && (filters.showBots || !isBot(r.author)) && scopeMatches(r),
    ),
    r => commitTypeGroup(r.type),
  )
  const data = [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  return donutBase(data.map(d => ({ ...d, color: commitTypeColor(d.name) })))
})

const devsOption = computed<EChartsOption>(() => {
  const rows = devsByCommits.value.slice(0, 10)
  return {
    tooltip: tooltipBase({ trigger: 'axis' }),
    // ECharts 6: outerBoundsMode/Contain substituem o legado `grid.containLabel`
    grid: { left: 8, right: 30, top: 10, bottom: 10, outerBoundsMode: 'same', outerBoundsContain: 'axisLabel' },
    xAxis: { type: 'value', axisLabel: axisLabel(), splitLine: splitLine() },
    yAxis: { type: 'category', data: rows.map(r => r.author), inverse: true, axisLabel: axisLabel() },
    series: [{ type: 'bar', data: rows.map(r => r.commits), itemStyle: { color: ct.primary }, barMaxWidth: 18 }],
  }
})

// ---------------------------------------------------------------------------
// timeline de releases (marcos — não segue o período)
// ---------------------------------------------------------------------------
const tags = computed(() => rel.value?.tags ?? [])
const shownTags = computed(() => tags.value.slice(0, 30))
</script>

<template>
  <div class="max-w-[1320px] w-full mx-auto px-5 py-6 flex flex-col gap-4">
    <!-- cabeçalho -->
    <DetailHeader to="/repos" back-label="repos" icon="i-lucide-git-branch" :title="repo">
      <a
        v-if="rel?.url"
        :href="rel.url"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
      >GitHub <UIcon name="i-lucide-arrow-up-right" class="size-3 align-[-2px]" /></a>
    </DetailHeader>

    <UAlert
      v-if="stats && !repoStats"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Repo não encontrado"
      description="Esse nome não aparece nos dados coletados. Confere a grafia ou rode pnpm collect."
    />

    <template v-else-if="repoStats">
      <!-- cards -->
      <StatCards :cards="cards" />

      <!-- gráficos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Tipos de commit" icon="i-lucide-chart-pie" :option="typesOption" />
        <ChartPanel title="Commits por dev" icon="i-lucide-chart-bar" :option="devsOption" />
      </div>

      <!-- releases -->
      <TablePanel title="Releases" icon="i-lucide-tag" :count="tags.length">
        <div v-if="!releases && !rel" class="py-10 text-center text-sm text-muted">
          Sem dados de release — rode <code>pnpm collect:releases</code>.
        </div>
        <div v-else-if="tags.length === 0" class="py-10 text-center text-sm text-muted">
          Esse repo não tem tags — nenhuma release registrada.
        </div>

        <table v-else class="data-table">
          <thead>
            <tr>
              <th>tag</th>
              <th class="num">
                data
              </th>
              <th class="num">
                commits
              </th>
              <th>notas</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in shownTags" :key="t.tag">
              <td class="whitespace-nowrap">
                <a
                  v-if="t.url"
                  :href="t.url"
                  target="_blank"
                  rel="noopener"
                  class="text-primary hover:underline"
                ><code class="text-xs bg-accented px-1 py-0.5 rounded">{{ t.tag }}</code></a>
                <code v-else class="text-xs bg-accented px-1 py-0.5 rounded">{{ t.tag }}</code>
                <UBadge v-if="t.prerelease" color="warning" variant="subtle" size="sm" class="ml-1">
                  pré
                </UBadge>
              </td>
              <td class="num whitespace-nowrap text-muted">
                {{ fmtDate(t.date) }}
              </td>
              <td class="num">
                {{ t.commits }}
              </td>
              <td class="max-w-[520px]">
                <span v-if="t.name" class="text-xs">{{ t.name }} </span>
                <details v-if="t.notes" class="inline">
                  <summary class="text-xs text-primary cursor-pointer inline">
                    notas
                  </summary>
                  <pre class="text-xs text-muted whitespace-pre-wrap mt-2 p-2 bg-accented rounded max-h-64 overflow-y-auto">{{ t.notes }}</pre>
                </details>
                <span v-if="!t.name && !t.notes" class="text-dimmed text-xs">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="tags.length > shownTags.length" class="text-dimmed text-xs px-4 pb-3 pt-2">
          mostrando as {{ shownTags.length }} mais recentes de {{ tags.length }} tags
        </p>
      </TablePanel>

      <!-- grafo de commits (issue #127) — janela fixa intencional: NÃO segue
           período/bots (remover commits quebraria as cadeias de merge); o
           rodapé do painel rotula a janela -->
      <section id="grafo" class="scroll-mt-16">
        <CommitGraph :repo="repo" />
      </section>
    </template>
  </div>
</template>
