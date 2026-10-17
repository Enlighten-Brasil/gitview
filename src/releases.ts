import type { ReleasesData, RepoReleases } from './types'
import { computed } from 'vue'
import { daysSince } from './format'
import { defineLoader } from './loader'

// loader do releases.json — mensagem fixa preservada (a UI concatena com o alerta)
const releasesLoader = defineLoader<ReleasesData>('releases.json', {
  errorMessage: 'sem dados de releases — rode "pnpm collect:releases"',
})
export const releases = releasesLoader.data
export const releasesError = releasesLoader.error
export const loadReleases = releasesLoader.load

/** repo -> dados de release (lookup rápido) */
export const releaseByRepo = computed(() =>
  new Map((releases.value?.repos ?? []).map(r => [r.repo, r])),
)

export function repoRelease(repo: string): RepoReleases | null {
  return releaseByRepo.value.get(repo) ?? null
}

/**
 * rótulo da última tag do repo — campo canônico `tag` (o `name` da release pode
 * ser null e nem toda tag tem release no GitHub); fonte única pra tabela de repos
 * e grade de releases mostrarem a MESMA string (null quando não há tags)
 */
export function lastTagLabel(repo: string): string | null {
  const r = releaseByRepo.value.get(repo)
  return r?.tags[0]?.tag ?? null
}

/** dias desde a última tag (null quando o repo não tem tags) */
export function daysSinceLastRelease(repo: string): number | null {
  const r = releaseByRepo.value.get(repo)
  const last = r?.tags[0]
  if (!last)
    return null
  return daysSince(last.date)
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
