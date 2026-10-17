import type { GitHubData, PullRequest } from './types'
import { computed } from 'vue'
import { authorSelected, inPeriodDay, repoSelected } from './filters-core'
import { daysSince, fmtDuration, median } from './format'
import { defineLoader } from './loader'

// compat: median/fmtDuration mudaram para ./format (issue #32) — reexportados
// aqui até os imports antigos terminarem de migrar
export { fmtDuration, median }
// predicados de filtro únicos (issue #39) — reexportados perto do consumo de PR
export { authorSelected, cutoff, inPeriodDay, inPeriodMonth, repoSelected } from './filters-core'

// loader do github.json — mensagem fixa preservada (a UI concatena com o alerta)
const githubLoader = defineLoader<GitHubData>('github.json', {
  errorMessage: 'sem dados do GitHub — rode "pnpm collect:github"',
})
export const github = githubLoader.data
export const githubError = githubLoader.error
export const loadGithub = githubLoader.load

// ---------------------------------------------------------------------------
// logins -> nomes do time (mapeamento vem do coletor via config.githubUsers)
// ---------------------------------------------------------------------------
export function ghName(login: string): string {
  return github.value?.users[login]?.name ?? login
}
export function ghIsBot(login: string): boolean {
  return github.value?.users[login]?.bot ?? /bot/i.test(login)
}

// ---------------------------------------------------------------------------
// filtros (mesmos da sidebar: repos, devs, período, bots) — predicados
// compartilhados vindos de ./filters-core (issue #39); o autor do PR é resolvido
// de login para nome canônico antes do authorSelected
// ---------------------------------------------------------------------------

/** PRs abertos agora (período não se aplica — aberto é "agora") */
export const openPrs = computed(() =>
  (github.value?.prs ?? []).filter(pr => pr.state === 'OPEN' && repoSelected(pr.repo) && authorSelected(ghName(pr.author), ghIsBot(pr.author))),
)

/** PRs mergeados dentro do período filtrado */
export const mergedPrs = computed(() =>
  (github.value?.prs ?? []).filter(pr => pr.state === 'MERGED' && repoSelected(pr.repo) && authorSelected(ghName(pr.author), ghIsBot(pr.author)) && inPeriodDay(pr.mergedAt)),
)

/** abertos com idade em dias, mais antigos primeiro */
export const openAging = computed(() =>
  openPrs.value
    .map(pr => ({ ...pr, ageDays: daysSince(pr.createdAt) }))
    .sort((a, b) => b.ageDays - a.ageDays),
)

/** cycle time em horas (criação -> merge) */
function cycleHours(pr: PullRequest): number {
  return (new Date(pr.mergedAt!).getTime() - new Date(pr.createdAt).getTime()) / 3_600_000
}

export const medianCycleHours = computed(() => median(mergedPrs.value.map(cycleHours)))

/** mediana de cycle time por repo (só repos com 3+ PRs no período) */
export const cycleByRepo = computed(() => {
  const byRepo = new Map<string, number[]>()
  for (const pr of mergedPrs.value) {
    const list = byRepo.get(pr.repo) ?? []
    list.push(cycleHours(pr))
    byRepo.set(pr.repo, list)
  }
  return [...byRepo.entries()]
    .map(([repo, hours]) => ({ repo, medianHours: median(hours), count: hours.length }))
    .filter(r => r.count >= 3)
    .sort((a, b) => b.medianHours - a.medianHours)
})

/** reviews feitas por dev no período (exclui self-review e bots) */
export const reviewsByDev = computed(() => {
  const byDev = new Map<string, { total: number, approvals: number, changes: number }>()
  for (const pr of mergedPrs.value) {
    for (const r of pr.reviews) {
      if (r.author === pr.author || ghIsBot(r.author))
        continue
      const name = ghName(r.author)
      const cur = byDev.get(name) ?? { total: 0, approvals: 0, changes: 0 }
      cur.total++
      if (r.state === 'APPROVED')
        cur.approvals++
      if (r.state === 'CHANGES_REQUESTED')
        cur.changes++
      byDev.set(name, cur)
    }
  }
  return [...byDev.entries()]
    .map(([dev, v]) => ({ dev, ...v }))
    .sort((a, b) => b.total - a.total)
})

/** concentração de reviews por repo no período filtrado (exclui self-review e bots) */
export interface RepoReviewShare {
  repo: string
  total: number // reviews de terceiros no período
  topReviewer: string
  topCount: number
  topShare: number // topCount / total
}

export const reviewShareByRepo = computed<RepoReviewShare[]>(() => {
  const byRepo = new Map<string, Map<string, number>>()
  for (const pr of mergedPrs.value) {
    for (const r of pr.reviews) {
      if (r.author === pr.author || ghIsBot(r.author))
        continue
      if (!byRepo.has(pr.repo))
        byRepo.set(pr.repo, new Map())
      const m = byRepo.get(pr.repo)!
      const name = ghName(r.author)
      m.set(name, (m.get(name) ?? 0) + 1)
    }
  }
  return [...byRepo.entries()]
    .map(([repo, m]) => {
      const sorted = [...m.entries()].sort((a, b) => b[1] - a[1])
      const total = sorted.reduce((s, [, v]) => s + v, 0)
      const [topReviewer, topCount] = sorted[0] ?? ['—', 0]
      return { repo, total, topReviewer, topCount, topShare: total > 0 ? topCount / total : 0 }
    })
    .sort((a, b) => b.topShare - a.topShare)
})

/** mergeados sem nenhuma review de outra pessoa */
export const mergedWithoutReview = computed(() => {
  const noReview = mergedPrs.value.filter(pr =>
    !pr.reviews.some(r => r.author !== pr.author && !ghIsBot(r.author)),
  )
  const pct = mergedPrs.value.length ? Math.round((noReview.length / mergedPrs.value.length) * 100) : 0
  return { count: noReview.length, pct }
})

// ---------------------------------------------------------------------------
// tendência de cycle time por repo — janela fixa de 6 meses (ignora o filtro de
// período: tendência precisa de vários meses), mas respeita repos/devs/bots
// ---------------------------------------------------------------------------
export interface CycleTrendRow {
  repo: string
  /** medianas por mês, mais antigo -> mais recente (só meses com PRs) */
  months: { month: string, medianHours: number, count: number }[]
  /** últimos 3 meses com dados estão estritamente subindo */
  rising: boolean
}

export const cycleTrend = computed<CycleTrendRow[]>(() => {
  // janela fixa de 6 meses (ignora o filtro de período) — predicados de
  // repo/autor continuam os mesmos da sidebar
  const trendStart = new Date()
  trendStart.setMonth(trendStart.getMonth() - 6)
  const prs = (github.value?.prs ?? []).filter(pr =>
    pr.state === 'MERGED' && pr.mergedAt && repoSelected(pr.repo) && authorSelected(ghName(pr.author), ghIsBot(pr.author))
    && new Date(pr.mergedAt) >= trendStart,
  )

  const byRepo = new Map<string, Map<string, number[]>>()
  for (const pr of prs) {
    const month = pr.mergedAt!.slice(0, 7)
    if (!byRepo.has(pr.repo))
      byRepo.set(pr.repo, new Map())
    const m = byRepo.get(pr.repo)!
    if (!m.has(month))
      m.set(month, [])
    m.get(month)!.push(cycleHours(pr))
  }

  return [...byRepo.entries()]
    .map(([repo, m]) => {
      const months = [...m.entries()]
        .map(([month, hours]) => ({ month, medianHours: median(hours), count: hours.length }))
        .sort((a, b) => a.month.localeCompare(b.month))
      const last3 = months.slice(-3)
      const rising = last3.length === 3
        && last3[0].medianHours < last3[1].medianHours
        && last3[1].medianHours < last3[2].medianHours
      return { repo, months, rising }
    })
    .filter(r => r.months.reduce((s, m) => s + m.count, 0) >= 3)
    .sort((a, b) => Number(b.rising) - Number(a.rising))
})

/** PRs abertos há mais de N dias (fluxo parado) */
export function stalePrs(days: number) {
  return openAging.value.filter(pr => pr.ageDays >= days)
}
