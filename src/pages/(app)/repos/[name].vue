<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import type { MergedPr } from '@/types'
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n({ useScope: 'global' })
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
    { value: fmtCompact(periodCommits.value), label: t('branches.repos.commits'), icon: 'i-lucide-git-commit-horizontal' },
    { value: fmtCompact(periodAdds.value), label: t('branches.repos.linesPlus'), icon: 'i-lucide-plus', color: 'text-success' },
    { value: fmtCompact(periodDels.value), label: t('branches.repos.linesMinus'), icon: 'i-lucide-minus', color: 'text-error' },
    { value: String(periodAuthors.value), label: periodAuthors.value === 1 ? t('branches.repos.cardDev') : t('branches.repos.cardDevs'), icon: 'i-lucide-users' },
  ]
  // com período/escopo ativos, mostra também o total histórico pra referência
  if (periodFiltered.value || scopeFiltered.value) {
    base.push({ value: fmtCompact(r.commits), label: t('branches.repos.cardCommitsTotal'), icon: 'i-lucide-infinity' })
  }
  if (rel.value) {
    base.push(
      {
        value: lastTagLabel(repo.value) ?? t('branches.sep.dash'),
        label: days != null ? t('branches.repos.cardLastRelease', { n: days }) : t('branches.repos.cardLastReleaseAny'),
        icon: 'i-lucide-tag',
      },
      {
        value: String(rel.value.unreleased),
        label: rel.value.unreleased === 1 ? t('branches.repos.cardUnreleased') : t('branches.repos.cardUnreleasedPlural'),
        icon: 'i-lucide-package-open',
        color: rel.value.unreleased >= UNRELEASED_RED ? 'text-error' : rel.value.unreleased >= UNRELEASED_AMBER ? 'text-warning' : undefined,
      },
    )
  }
  if (topDev.value) {
    base.push({
      value: `${topDev.value.author.split(' ')[0]} (${Math.round(topDev.value.share * 100)}%)`,
      label: t('branches.repos.cardTopDev'),
      icon: 'i-lucide-bus',
      color: topDev.value.share >= DEV_SHARE_RED ? 'text-error' : topDev.value.share >= DEV_SHARE_AMBER ? 'text-warning' : undefined,
    })
  }
  if (github.value) {
    base.push(
      { value: String(openPrs.value.length), label: openPrs.value.length === 1 ? t('branches.repos.cardOpenPr') : t('branches.repos.cardOpenPrs'), icon: 'i-lucide-git-pull-request' },
      { value: fmtDuration(cycleHours.value), label: t('branches.repos.cardCycleTime'), icon: 'i-lucide-timer' },
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
    <DetailHeader to="/repos" :back-label="t('branches.back.repos')" icon="i-lucide-git-branch" :title="repo">
      <a
        v-if="rel?.url"
        :href="rel.url"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
      >{{ t('branches.label.github') }} <UIcon name="i-lucide-arrow-up-right" class="size-3 align-[-2px]" /></a>
    </DetailHeader>

    <UAlert
      v-if="stats && !repoStats"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('branches.repos.notFound')"
      :description="t('branches.repos.notFoundDesc')"
    />

    <template v-else-if="repoStats">
      <!-- cards -->
      <StatCards :cards="cards" />

      <!-- gráficos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel :title="t('branches.repos.chartTypes')" icon="i-lucide-chart-pie" :option="typesOption" />
        <ChartPanel :title="t('branches.repos.chartDevs')" icon="i-lucide-chart-bar" :option="devsOption" />
      </div>

      <!-- releases -->
      <TablePanel :title="t('branches.repos.releasesTitle')" icon="i-lucide-tag" :count="tags.length">
        <!-- ponytail: o comando e o "." final viraram chaves próprias porque o
             no-raw-text trata nó de texto estático como copy (#265 revê a regra) -->
        <div v-if="!releases && !rel" class="py-10 text-center text-sm text-muted">
          {{ ` ${t('branches.repos.releasesMissing')}` }} <code>{{ t('branches.repos.releasesCmd') }}</code>{{ `${t('branches.repos.releasesPeriod')} ` }}
        </div>
        <div v-else-if="tags.length === 0" class="py-10 text-center text-sm text-muted">
          {{ ` ${t('branches.repos.noTags')} ` }}
        </div>

        <table v-else class="data-table">
          <thead>
            <tr>
              <th>{{ t('branches.repos.thTag') }}</th>
              <th class="num">
                {{ ` ${t('branches.repos.thDate')} ` }}
              </th>
              <th class="num">
                {{ ` ${t('branches.repos.commits')} ` }}
              </th>
              <th>{{ t('branches.repos.notes') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in shownTags" :key="row.tag">
              <td class="whitespace-nowrap">
                <a
                  v-if="row.url"
                  :href="row.url"
                  target="_blank"
                  rel="noopener"
                  class="text-primary hover:underline"
                ><code class="text-xs bg-accented px-1 py-0.5 rounded">{{ row.tag }}</code></a>
                <code v-else class="text-xs bg-accented px-1 py-0.5 rounded">{{ row.tag }}</code>
                <UBadge v-if="row.prerelease" color="warning" variant="subtle" size="sm" class="ml-1">
                  {{ ` ${t('branches.repos.prerelease')} ` }}
                </UBadge>
              </td>
              <td class="num whitespace-nowrap text-muted">
                {{ fmtDate(row.date) }}
              </td>
              <td class="num">
                {{ row.commits }}
              </td>
              <td class="max-w-[520px]">
                <span v-if="row.name" class="text-xs">{{ row.name }} </span>
                <details v-if="row.notes" class="inline">
                  <summary class="text-xs text-primary cursor-pointer inline">
                    {{ ` ${t('branches.repos.notes')} ` }}
                  </summary>
                  <pre class="text-xs text-muted whitespace-pre-wrap mt-2 p-2 bg-accented rounded max-h-64 overflow-y-auto">{{ row.notes }}</pre>
                </details>
                <span v-if="!row.name && !row.notes" class="text-dimmed text-xs">{{ t('branches.sep.dash') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="tags.length > shownTags.length" class="text-dimmed text-xs px-4 pb-3 pt-2">
          {{ ` ${t('branches.repos.showing', { shown: shownTags.length, total: tags.length })} ` }}
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
