<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { EChartsOption } from 'echarts'
import { filters, inRange, isCustomRange, loadCommits, rangeLabel, recentCommits, stats } from '../data'
import { fmtDuration, ghName, github, median } from '../github'
import { axisLabel, ct, heatRamp, legendText, PALETTE, splitLine, tooltipBase } from '../chartTheme'
import ChartPanel from '../components/ChartPanel.vue'

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const route = useRoute()
const dev = computed(() => String(route.params.name ?? ''))

onMounted(loadCommits)

const authorStats = computed(() =>
  stats.value?.perAuthor.find(a => a.author === dev.value) ?? null,
)

// sugestões de nomes parecidos quando o dev não existe (fuzzy por substring/lower)
const suggestions = computed(() => {
  if (!stats.value || authorStats.value) return []
  const q = dev.value.toLowerCase()
  if (!q) return []
  const all = stats.value.perAuthor.map(a => a.author)
  const exact = all.filter(n => n.toLowerCase().includes(q) || q.includes(n.toLowerCase()))
  const pool = exact.length ? exact : all.filter(n => {
    const nl = n.toLowerCase()
    // tokens em comum (nome/sobrenome parcial)
    const qt = q.split(/[\s._-]+/).filter(Boolean)
    const nt = nl.split(/[\s._-]+/).filter(Boolean)
    return qt.some(t => nt.some(x => x.startsWith(t) || t.startsWith(x)))
  })
  return pool.slice(0, 5)
})

// o período se aplica nesta página: com preset/range ativo, commits, gráficos e
// PRs ficam restritos ao período; "Tudo" = histórico completo (heatmap sempre capado em 24M)
const periodFiltered = computed(() => filters.rangeMonths !== null || isCustomRange())
// sufixo dos cards que seguem históricos mesmo com período ativo
const histSuffix = computed(() => (periodFiltered.value ? ' (total)' : ''))

// linhas mensais do dev dentro do período — base dos cards de commits/linhas
// (com "Tudo", inRange aceita todos os meses e a soma equivale ao total histórico)
const myMonthly = computed(() =>
  (stats.value?.monthly ?? []).filter(r => r.author === dev.value && inRange(r.month)),
)
const periodCommits = computed(() => myMonthly.value.reduce((s, r) => s + r.commits, 0))
const periodAdds = computed(() => myMonthly.value.reduce((s, r) => s + r.additions, 0))
const periodDels = computed(() => myMonthly.value.reduce((s, r) => s + r.deletions, 0))

function fmt(n: number): string {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000)
    return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString('pt-BR')
}

// ---------------------------------------------------------------------------
// PRs do dev (dados do GitHub, se coletados)
// ---------------------------------------------------------------------------
const myPrs = computed(() => (github.value?.prs ?? []).filter(pr => ghName(pr.author) === dev.value))
const myOpen = computed(() => myPrs.value.filter(p => p.state === 'OPEN'))
// mergeados filtrados pelo período (mês do merge)
const myMerged = computed(() => myPrs.value.filter(p => p.state === 'MERGED' && p.mergedAt && inRange(p.mergedAt.slice(0, 7))))
const myCycleHours = computed(() =>
  median(myMerged.value.map(p => (new Date(p.mergedAt!).getTime() - new Date(p.createdAt).getTime()) / 3_600_000)),
)
/** reviews que o dev FEZ em PRs de outras pessoas — filtradas pelo período */
const myReviews = computed(() => {
  let total = 0
  let approvals = 0
  for (const pr of github.value?.prs ?? []) {
    for (const r of pr.reviews) {
      if (ghName(r.author) !== dev.value || r.author === pr.author)
        continue
      if (!inRange(r.submittedAt.slice(0, 7)))
        continue
      total++
      if (r.state === 'APPROVED')
        approvals++
    }
  }
  return { total, approvals }
})

const cards = computed(() => {
  const a = authorStats.value
  if (!a)
    return []
  const base = [
    { value: fmt(periodCommits.value), label: 'commits', icon: 'i-lucide-git-commit-horizontal' },
    { value: fmt(periodAdds.value), label: 'linhas +', icon: 'i-lucide-plus', color: 'text-success' },
    { value: fmt(periodDels.value), label: 'linhas −', icon: 'i-lucide-minus', color: 'text-error' },
    { value: String(a.activeDays), label: `dias ativos${histSuffix.value}`, icon: 'i-lucide-calendar-check' },
    { value: (a.commits / Math.max(a.activeDays, 1)).toFixed(1), label: `commits/dia ativo${histSuffix.value}`, icon: 'i-lucide-zap' },
    { value: `${a.streak} (máx ${a.longestStreak})`, label: `streak 🔥${histSuffix.value}`, icon: 'i-lucide-flame' },
    { value: String(a.repos), label: `repositórios${histSuffix.value}`, icon: 'i-lucide-git-branch' },
  ]
  if (github.value) {
    base.push(
      { value: String(myOpen.value.length), label: 'PRs abertos', icon: 'i-lucide-git-pull-request' },
      { value: fmtDuration(myCycleHours.value), label: 'cycle time mediano', icon: 'i-lucide-timer' },
      { value: `${myReviews.value.total} (${myReviews.value.approvals} ✓)`, label: 'reviews feitas', icon: 'i-lucide-eye' },
    )
  }
  return base
})

// ---------------------------------------------------------------------------
// gráficos
// ---------------------------------------------------------------------------
const timelineOption = computed<EChartsOption>(() => {
  const rows = (stats.value?.weekly ?? []).filter(r => r.author === dev.value && inRange(r.week))
  const byWeek = new Map<string, number>()
  for (const r of rows)
    byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + r.commits)
  const weeks = [...byWeek.keys()].sort()

  return {
    tooltip: tooltipBase({ trigger: 'axis' }),
    grid: { left: 50, right: 20, top: 20, bottom: 60 },
    xAxis: { type: 'category', data: weeks, axisLabel: axisLabel() },
    yAxis: { type: 'value', axisLabel: axisLabel(), splitLine: splitLine() },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }],
    series: [{ type: 'bar', data: weeks.map(w => byWeek.get(w) ?? 0), itemStyle: { color: ct.primary } }],
  }
})

const repoOption = computed<EChartsOption>(() => {
  const map = new Map<string, number>()
  for (const r of stats.value?.monthly ?? []) {
    if (r.author !== dev.value || !inRange(r.month))
      continue
    map.set(r.repo, (map.get(r.repo) ?? 0) + r.commits)
  }
  const data = [...map.entries()].map(([repo, commits]) => ({ name: repo, value: commits })).sort((a, b) => b.value - a.value)

  return {
    color: PALETTE,
    tooltip: tooltipBase({ trigger: 'item', formatter: '{b}: {c} commits ({d}%)' }),
    legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: legendText() },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['38%', '50%'],
      itemStyle: { borderColor: ct.bg, borderWidth: 2 },
      label: { show: false },
      data,
    }],
  }
})

const heatOption = computed<EChartsOption>(() => {
  const map = new Map<string, number>()
  let max = 0
  for (const r of stats.value?.heatmap ?? []) {
    if (r.author !== dev.value || !inRange(r.month))
      continue
    const k = `${r.weekday}|${r.hour}`
    const v = (map.get(k) ?? 0) + r.commits
    map.set(k, v)
    if (v > max)
      max = v
  }
  const data: [number, number, number][] = []
  for (const [k, v] of map) {
    const [weekday, hour] = k.split('|').map(Number)
    data.push([hour, weekday, v])
  }

  return {
    tooltip: tooltipBase({
      formatter: (p: unknown) => {
        const d = (p as { data: [number, number, number] }).data
        return `${WEEKDAYS[d[1]]} ${String(d[0]).padStart(2, '0')}h: <b>${d[2]}</b> commits`
      },
    }),
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, h) => `${h}h`), axisLabel: axisLabel() },
    yAxis: { type: 'category', data: WEEKDAYS, axisLabel: axisLabel() },
    visualMap: {
      min: 0,
      max: Math.max(max, 1),
      show: false,
      inRange: { color: heatRamp('success') },
    },
    series: [{ type: 'heatmap', data }],
  }
})

// título do heatmap: em "Tudo" o coletor capa em 24M; com período, mostra o range
const heatTitle = computed(() =>
  periodFiltered.value ? `Horários de atividade — ${rangeLabel.value}` : 'Horários de atividade — últimos 24 meses',
)

// ---------------------------------------------------------------------------
// últimos commits — filtrados pelo período
// ---------------------------------------------------------------------------
const commits = computed(() =>
  (recentCommits.value ?? []).filter(c => c.author === dev.value && inRange(c.date.slice(0, 7))).slice(0, 50),
)

function fmtCommitDate(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-BR')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** link pro commit no GitHub (quando o repo tem remote mapeado) */
function commitUrl(repo: string, hash: string): string | null {
  const base = stats.value?.repoUrls?.[repo]
  return base ? `${base}/commit/${hash}` : null
}
</script>

<template>
  <div class="max-w-[1320px] w-full mx-auto px-5 py-6 flex flex-col gap-4">
    <!-- cabeçalho do perfil -->
    <div class="flex items-center gap-3 flex-wrap">
      <UButton
        to="/"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        label="dashboard"
      />
      <UIcon name="i-lucide-user" class="size-6 text-primary" />
      <h1 class="text-xl font-bold text-highlighted">
        {{ dev }}
      </h1>
      <span class="text-xs text-dimmed">— {{ rangeLabel }}</span>
    </div>

    <div v-if="stats && !authorStats" class="flex flex-col gap-3">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-user-x"
        title="Dev não encontrado"
        description="Esse nome não aparece nos commits coletados. Confere a grafia ou rode pnpm collect."
      />
      <div v-if="suggestions.length" class="text-sm">
        <p class="text-dimmed mb-2">
          Quis dizer:
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="s in suggestions"
            :key="s"
            :to="`/dev/${encodeURIComponent(s)}`"
            color="neutral"
            variant="soft"
            size="sm"
            :label="s"
            icon="i-lucide-user-round"
          />
        </div>
      </div>
    </div>

    <template v-else-if="authorStats">
      <!-- cards -->
      <div class="dev-cards-grid">
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
      <ChartPanel title="Commits por semana" icon="i-lucide-chart-column" :option="timelineOption" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Distribuição por repositório" icon="i-lucide-chart-pie" :option="repoOption" />
        <ChartPanel :title="heatTitle" icon="i-lucide-clock" :option="heatOption" />
      </div>

      <!-- PRs abertos do dev -->
      <UCard v-if="myOpen.length" :ui="{ body: 'p-0 sm:p-0', header: 'py-3 px-4 sm:px-4' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-git-pull-request-arrow" class="size-4 text-primary" />
            <span class="text-sm font-semibold text-highlighted">PRs abertos de {{ dev.split(' ')[0] }}</span>
            <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto">
              {{ myOpen.length }}
            </UBadge>
          </div>
        </template>
        <table class="data-table">
          <tbody>
            <tr v-for="pr in myOpen" :key="`${pr.repo}#${pr.number}`">
              <td class="max-w-[480px]">
                <a :href="pr.url" target="_blank" rel="noopener" class="text-primary hover:underline truncate block">
                  #{{ pr.number }} {{ pr.title }}
                </a>
              </td>
              <td class="whitespace-nowrap text-muted">
                {{ pr.repo }}
              </td>
              <td class="num whitespace-nowrap text-muted">
                {{ Math.floor((Date.now() - new Date(pr.createdAt).getTime()) / 86_400_000) }}d aberto
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>

      <!-- últimos commits -->
      <UCard :ui="{ body: 'p-0 sm:p-0', header: 'py-3 px-4 sm:px-4' }">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-history" class="size-4 text-primary" />
            <span class="text-sm font-semibold text-highlighted">Últimos commits</span>
            <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto">
              {{ commits.length }}
            </UBadge>
          </div>
        </template>
        <div v-if="commits.length" class="overflow-x-auto">
          <table class="data-table">
            <thead>
              <tr>
                <th>data</th>
                <th>repo</th>
                <th>hash</th>
                <th>mensagem</th>
                <th class="num">
                  +/−
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in commits" :key="`${c.repo}@${c.hash}`">
                <td class="whitespace-nowrap text-muted">
                  {{ fmtCommitDate(c.date) }}
                </td>
                <td class="whitespace-nowrap text-muted">
                  {{ c.repo }}
                </td>
                <td>
                  <a
                    v-if="commitUrl(c.repo, c.hash)"
                    :href="commitUrl(c.repo, c.hash)!"
                    target="_blank"
                    rel="noopener"
                    class="text-primary hover:underline"
                  ><code class="text-xs bg-accented px-1 py-0.5 rounded">{{ c.hash }}</code></a>
                  <code v-else class="text-xs bg-accented px-1 py-0.5 rounded">{{ c.hash }}</code>
                </td>
                <td class="max-w-[520px] truncate" :title="c.message">
                  {{ c.message }}
                </td>
                <td class="num whitespace-nowrap">
                  <span class="add">+{{ c.additions.toLocaleString('pt-BR') }}</span>
                  <span class="del ml-1">−{{ c.deletions.toLocaleString('pt-BR') }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="py-10 text-center text-sm text-muted">
          Sem commits no período — ajuste o filtro ou rode <code>pnpm collect</code> para gerar o commits.json.
        </div>
      </UCard>
    </template>
  </div>
</template>

<style scoped>
.dev-cards-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
</style>
