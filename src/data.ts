import { computed, reactive, ref } from 'vue'
import type { Stats } from './types'

export const stats = ref<Stats | null>(null)
export const loadError = ref<string | null>(null)

export const filters = reactive({
  repos: [] as string[],      // vazio = todos
  authors: [] as string[],    // vazio = todos
  rangeMonths: 12 as number | null, // null = todo o histórico
  showBots: false,
})

const botNames = computed(() => new Set((stats.value?.authors ?? []).filter(a => a.bot).map(a => a.name)))
export function isBot(author: string) {
  return botNames.value.has(author)
}

export async function loadStats() {
  try {
    const res = await fetch('./data/stats.json')
    if (!res.ok) throw new Error(`HTTP ${res.status} — rode "pnpm collect" primeiro`)
    stats.value = await res.json()
  }
  catch (err) {
    loadError.value = (err as Error).message
  }
}

function cutoffDate(): Date | null {
  if (filters.rangeMonths == null) return null
  const d = new Date()
  d.setMonth(d.getMonth() - filters.rangeMonths)
  return d
}

function inRange(periodKey: string): boolean {
  const cutoff = cutoffDate()
  if (!cutoff) return true
  // periodKey é "YYYY-Www" ou "YYYY-MM" — compara pelo começo do período
  return periodKey.slice(0, 7) >= `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`
}

function selectedRepo(repo: string) {
  return filters.repos.length === 0 || filters.repos.includes(repo)
}
function selectedAuthor(author: string) {
  if (!filters.showBots && isBot(author)) return false
  return filters.authors.length === 0 || filters.authors.includes(author)
}

export const filteredWeekly = computed(() =>
  (stats.value?.weekly ?? []).filter(r => selectedRepo(r.repo) && selectedAuthor(r.author) && inRange(r.week)),
)

export const filteredMonthly = computed(() =>
  (stats.value?.monthly ?? []).filter(r => selectedRepo(r.repo) && selectedAuthor(r.author) && inRange(r.month)),
)

export const filteredHeatmap = computed(() =>
  (stats.value?.heatmap ?? []).filter(r => selectedRepo(r.repo) && selectedAuthor(r.author)),
)

/** commits no período filtrado (para cards) */
export const filteredCommitCount = computed(() =>
  filteredMonthly.value.reduce((acc, r) => acc + r.commits, 0),
)

/** commits por repo no filtro atual (para o donut) */
export const commitsByRepo = computed(() => {
  const map = new Map<string, number>()
  for (const r of filteredMonthly.value) map.set(r.repo, (map.get(r.repo) ?? 0) + r.commits)
  return [...map.entries()].map(([repo, commits]) => ({ repo, commits })).sort((a, b) => b.commits - a.commits)
})

/** commits por autor no filtro atual */
export const commitsByAuthor = computed(() => {
  const map = new Map<string, number>()
  for (const r of filteredMonthly.value) map.set(r.author, (map.get(r.author) ?? 0) + r.commits)
  return [...map.entries()].map(([author, commits]) => ({ author, commits })).sort((a, b) => b.commits - a.commits)
})
