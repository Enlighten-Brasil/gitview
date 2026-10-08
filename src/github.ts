import { computed, ref } from 'vue'
import type { GitHubData, PullRequest } from './types'
import { filters } from './data'

export const github = ref<GitHubData | null>(null)
export const githubError = ref<string | null>(null)

export async function loadGithub() {
  try {
    const res = await fetch('/data/github.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    github.value = await res.json()
  }
  catch {
    githubError.value = 'sem dados do GitHub — rode "pnpm collect:github"'
  }
}

// ---------------------------------------------------------------------------
// logins -> nomes do time (mapeamento vem do coletor via config.githubUsers)
// ---------------------------------------------------------------------------
export function ghName(login: string): string {
  return github.value?.users[login]?.name ?? login
}
function ghIsBot(login: string): boolean {
  return github.value?.users[login]?.bot ?? /bot/i.test(login)
}

// ---------------------------------------------------------------------------
// filtros (mesmos da sidebar: repos, devs, período, bots)
// ---------------------------------------------------------------------------
function repoOk(repo: string) {
  return filters.repos.length === 0 || filters.repos.includes(repo)
}
function authorOk(login: string) {
  if (!filters.showBots && ghIsBot(login)) return false
  return filters.authors.length === 0 || filters.authors.includes(ghName(login))
}
function cutoff(): Date | null {
  if (filters.rangeMonths == null) return null
  const d = new Date()
  d.setMonth(d.getMonth() - filters.rangeMonths)
  return d
}
function inPeriod(iso: string | null): boolean {
  if (!iso) return false
  const c = cutoff()
  return !c || new Date(iso) >= c
}

/** PRs abertos agora (período não se aplica — aberto é "agora") */
export const openPrs = computed(() =>
  (github.value?.prs ?? []).filter(pr => pr.state === 'OPEN' && repoOk(pr.repo) && authorOk(pr.author)),
)

/** PRs mergeados dentro do período filtrado */
export const mergedPrs = computed(() =>
  (github.value?.prs ?? []).filter(pr => pr.state === 'MERGED' && repoOk(pr.repo) && authorOk(pr.author) && inPeriod(pr.mergedAt)),
)

/** abertos com idade em dias, mais antigos primeiro */
export const openAging = computed(() =>
  openPrs.value
    .map(pr => ({ ...pr, ageDays: Math.floor((Date.now() - new Date(pr.createdAt).getTime()) / 86_400_000) }))
    .sort((a, b) => b.ageDays - a.ageDays),
)

/** cycle time em horas (criação -> merge) */
function cycleHours(pr: PullRequest): number {
  return (new Date(pr.mergedAt!).getTime() - new Date(pr.createdAt).getTime()) / 3_600_000
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
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
  const byDev = new Map<string, { total: number; approvals: number; changes: number }>()
  for (const pr of mergedPrs.value) {
    for (const r of pr.reviews) {
      if (r.author === pr.author || ghIsBot(r.author)) continue
      const name = ghName(r.author)
      const cur = byDev.get(name) ?? { total: 0, approvals: 0, changes: 0 }
      cur.total++
      if (r.state === 'APPROVED') cur.approvals++
      if (r.state === 'CHANGES_REQUESTED') cur.changes++
      byDev.set(name, cur)
    }
  }
  return [...byDev.entries()]
    .map(([dev, v]) => ({ dev, ...v }))
    .sort((a, b) => b.total - a.total)
})

/** mergeados sem nenhuma review de outra pessoa */
export const mergedWithoutReview = computed(() => {
  const noReview = mergedPrs.value.filter(pr =>
    !pr.reviews.some(r => r.author !== pr.author && !ghIsBot(r.author)),
  )
  const pct = mergedPrs.value.length ? Math.round((noReview.length / mergedPrs.value.length) * 100) : 0
  return { count: noReview.length, pct }
})

/** horas -> "18h" / "2,3d" / "1,5sem" */
export function fmtDuration(hours: number): string {
  if (hours < 1) return '<1h'
  if (hours < 48) return `${Math.round(hours)}h`
  const days = hours / 24
  if (days < 14) return `${days.toFixed(1).replace('.', ',')}d`
  return `${(days / 7).toFixed(1).replace('.', ',')}sem`
}
