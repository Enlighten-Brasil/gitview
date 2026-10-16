import type { ReleasesData, RepoReleases } from './types'
import { computed, ref } from 'vue'

export const releases = ref<ReleasesData | null>(null)
export const releasesError = ref<string | null>(null)

export async function loadReleases(force = false) {
  try {
    const res = await fetch(force ? `/data/releases.json?t=${Date.now()}` : '/data/releases.json')
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`)
    releases.value = await res.json()
    releasesError.value = null
  }
  catch {
    releasesError.value = 'sem dados de releases — rode "pnpm collect:releases"'
  }
}

/** repo -> dados de release (lookup rápido) */
export const releaseByRepo = computed(() =>
  new Map((releases.value?.repos ?? []).map(r => [r.repo, r])),
)

export function repoRelease(repo: string): RepoReleases | null {
  return releaseByRepo.value.get(repo) ?? null
}

/** dias desde a última tag (null quando o repo não tem tags) */
export function daysSinceLastRelease(repo: string): number | null {
  const r = releaseByRepo.value.get(repo)
  const last = r?.tags[0]
  if (!last)
    return null
  return Math.floor((Date.now() - new Date(last.date).getTime()) / 86_400_000)
}

/** releases por mês nos últimos 12 meses (cadência) */
export function releasesPerMonth(repo: string): number {
  const r = releaseByRepo.value.get(repo)
  if (!r)
    return 0
  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() - 12)
  return r.tags.filter(t => new Date(t.date) >= cutoff).length / 12
}
