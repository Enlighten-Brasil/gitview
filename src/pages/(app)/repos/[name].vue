<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { axisLabel, ct, legendText, splitLine, tooltipBase } from '@/chartTheme'
import ChartPanel from '@/components/ChartPanel.vue'
import { filters, inRange, isBot, isCustomRange, rangeLabel, stats } from '@/data'
import { fmtDuration, ghIsBot, github, median } from '@/github'
import { daysSinceLastRelease, loadReleases, releases, repoRelease } from '@/releases'

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
// sufixo dos cards que seguem históricos mesmo com período ativo
const histSuffix = computed(() => (periodFiltered.value ? ' (total)' : ''))

// linhas mensais do repo dentro do período, respeitando o switch de bots
// (com "Tudo", inRange aceita todos os meses e a soma equivale ao total histórico)
const periodMonthly = computed(() =>
  (stats.value?.monthly ?? []).filter(r =>
    r.repo === repo.value
    && (filters.showBots || !isBot(r.author))
    && inRange(r.month),
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
// mergeados filtrados pelo período (mês do merge)
const mergedPrs = computed(() =>
  repoPrs.value.filter(p => p.state === 'MERGED' && p.mergedAt && inRange(p.mergedAt.slice(0, 7))),
)
const cycleHours = computed(() =>
  median(mergedPrs.value.map(p => (new Date(p.mergedAt!).getTime() - new Date(p.createdAt).getTime()) / 3_600_000)),
)

/** commits por dev no período (ranking + bus factor) */
const devsByCommits = computed(() => {
  const map = new Map<string, number>()
  for (const r of periodMonthly.value)
    map.set(r.author, (map.get(r.author) ?? 0) + r.commits)
  return [...map.entries()].map(([author, commits]) => ({ author, commits })).sort((a, b) => b.commits - a.commits)
})

const topDev = computed(() => {
  const total = devsByCommits.value.reduce((s, d) => s + d.commits, 0)
  const top = devsByCommits.value[0]
  return top && total > 0 ? { author: top.author, share: top.commits / total } : null
})

function fmt(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)
    return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString('pt-BR')
}

const cards = computed(() => {
  const r = repoStats.value
  if (!r)
    return []
  const days = daysSinceLastRelease(repo.value)
  const base = [
    { value: fmt(periodCommits.value), label: 'commits', icon: 'i-lucide-git-commit-horizontal' },
    { value: fmt(periodAdds.value), label: 'linhas +', icon: 'i-lucide-plus', color: 'text-success' },
    { value: fmt(periodDels.value), label: 'linhas −', icon: 'i-lucide-minus', color: 'text-error' },
    { value: String(periodAuthors.value), label: 'devs', icon: 'i-lucide-users' },
  ]
  // com período ativo, mostra também o total histórico pra referência
  if (periodFiltered.value) {
    base.push({ value: fmt(r.commits), label: `commits${histSuffix.value}`, icon: 'i-lucide-infinity' })
  }
  if (rel.value) {
    base.push(
      {
        value: rel.value.tags[0]?.tag ?? '—',
        label: days != null ? `última release (há ${days}d)` : 'última release',
        icon: 'i-lucide-tag',
      },
      {
        value: String(rel.value.unreleased),
        label: 'commits não liberados',
        icon: 'i-lucide-package-open',
        color: rel.value.unreleased >= 50 ? 'text-error' : rel.value.unreleased >= 20 ? 'text-warning' : undefined,
      },
    )
  }
  if (topDev.value) {
    base.push({
      value: `${topDev.value.author.split(' ')[0]} (${Math.round(topDev.value.share * 100)}%)`,
      label: 'dev principal',
      icon: 'i-lucide-bus',
      color: topDev.value.share >= 0.7 ? 'text-error' : topDev.value.share >= 0.5 ? 'text-warning' : undefined,
    })
  }
  if (github.value) {
    base.push(
      { value: String(openPrs.value.length), label: 'PRs abertos', icon: 'i-lucide-git-pull-request' },
      { value: fmtDuration(cycleHours.value), label: 'cycle time mediano', icon: 'i-lucide-timer' },
    )
  }
  return base
})

// ---------------------------------------------------------------------------
// gráficos: tipos de commit + commits por dev
// ---------------------------------------------------------------------------
const TYPES = ['feat', 'fix', 'refactor', 'chore', 'outros'] as const
const TYPE_COLORS: Record<string, string> = {
  feat: ct.primary,
  fix: ct.error500,
  refactor: ct.violet500,
  chore: ct.warning500,
  outros: ct.textDim,
}

const typesOption = computed<EChartsOption>(() => {
  const map = new Map<string, number>()
  for (const r of stats.value?.monthlyTypes ?? []) {
    if (r.repo !== repo.value || !inRange(r.month))
      continue
    if (!filters.showBots && isBot(r.author))
      continue
    const t = (TYPES as readonly string[]).includes(r.type) ? r.type : 'outros'
    map.set(t, (map.get(t) ?? 0) + r.commits)
  }
  const data = [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  return {
    tooltip: tooltipBase({ trigger: 'item', formatter: '{b}: {c} commits ({d}%)' }),
    legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: legendText() },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['38%', '50%'],
      itemStyle: { borderColor: ct.bg, borderWidth: 2 },
      label: { show: false },
      data: data.map(d => ({ ...d, itemStyle: { color: TYPE_COLORS[d.name] } })),
    }],
  }
})

const devsOption = computed<EChartsOption>(() => {
  const rows = devsByCommits.value.slice(0, 10)
  return {
    tooltip: tooltipBase({ trigger: 'axis' }),
    grid: { left: 8, right: 30, top: 10, bottom: 10, containLabel: true },
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

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}
</script>

<template>
  <div class="max-w-[1320px] w-full mx-auto px-5 py-6 flex flex-col gap-4">
    <!-- cabeçalho -->
    <div class="flex items-center gap-3 flex-wrap">
      <UButton
        to="/repos"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        label="repos"
      />
      <UIcon name="i-lucide-git-branch" class="size-6 text-primary" />
      <h1 class="text-xl font-bold text-highlighted">
        {{ repo }}
      </h1>
      <a
        v-if="rel?.url"
        :href="rel.url"
        target="_blank"
        rel="noopener"
        class="text-xs text-primary hover:underline"
      >GitHub ↗</a>
      <span class="text-xs text-dimmed">— {{ rangeLabel }}</span>
    </div>

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
      <div class="repo-cards-grid">
        <div v-for="c in cards" :key="c.label" class="stat-card">
          <div class="flex items-center gap-2">
            <UIcon :name="c.icon" class="size-4" :class="c.color ?? 'text-muted'" />
            <span class="text-xl font-bold tracking-tight truncate">{{ c.value }}</span>
          </div>
          <div class="text-xs text-muted mt-1">
            {{ c.label }}
          </div>
        </div>
      </div>

      <!-- gráficos -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Tipos de commit" icon="i-lucide-chart-pie" :option="typesOption" />
        <ChartPanel title="Commits por dev" icon="i-lucide-chart-bar" :option="devsOption" />
      </div>

      <!-- releases -->
      <UCard :ui="{ body: 'p-0 sm:p-0', header: 'py-3 px-4 sm:px-4' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-tag" class="size-4 text-primary" />
            <span class="text-sm font-semibold text-highlighted">Releases</span>
            <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto">
              {{ tags.length }}
            </UBadge>
          </div>
        </template>

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
      </UCard>
    </template>
  </div>
</template>

<style scoped>
.repo-cards-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
</style>
