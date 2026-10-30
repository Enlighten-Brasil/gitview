/**
 * Lógica pura dos painéis novos da Visão geral (fluxo de PRs, top devs, mix de
 * tipos, off-hours agregado) — separada dos componentes para nascer testada
 * (convenção do repo) e ficar independente do Vue/ECharts.
 */
import type { CommitType } from './commitTypes'
import { COMMIT_TYPES, commitTypeGroup } from './commitTypes'
import { isoWeekKey } from './date'

// ---------------------------------------------------------------------------
// fluxo de entrega: PRs criados × mergeados por semana ISO (janela fixa)
// ---------------------------------------------------------------------------
export interface PrFlowPoint {
  week: string
  /** PRs criados na semana */
  opened: number
  /** PRs mergeados na semana */
  merged: number
}

/** conta criados/mergeados por semana — PRs fora da janela caem fora do eixo */
export function weeklyPrFlow(
  prs: readonly { createdAt: string, mergedAt: string | null }[],
  weeks: readonly string[],
): PrFlowPoint[] {
  const by = new Map<string, PrFlowPoint>(weeks.map(w => [w, { week: w, opened: 0, merged: 0 }]))
  for (const pr of prs) {
    const o = by.get(isoWeekKey(new Date(pr.createdAt)))
    if (o)
      o.opened++
    if (pr.mergedAt) {
      const m = by.get(isoWeekKey(new Date(pr.mergedAt)))
      if (m)
        m.merged++
    }
  }
  return weeks.map(w => by.get(w) ?? { week: w, opened: 0, merged: 0 })
}

// ---------------------------------------------------------------------------
// top devs do período: commits (stats) unidos aos PRs merged (github) por dev
// ---------------------------------------------------------------------------
export interface TopDevRow {
  author: string
  commits: number
  prs: number
}

export interface TopDevsResult {
  /** top N por commits — desempate por nome */
  rows: TopDevRow[]
  /** agregado dos devs fora do top (null quando todo mundo cabe) */
  rest: { devs: number, commits: number, prs: number } | null
}

export function topDevs(
  commitsRows: readonly { author: string, commits: number }[],
  prsByDev: ReadonlyMap<string, number>,
  n: number,
): TopDevsResult {
  const all = commitsRows
    .map(r => ({ author: r.author, commits: r.commits, prs: prsByDev.get(r.author) ?? 0 }))
    .sort((a, b) => b.commits - a.commits || a.author.localeCompare(b.author))
  const rows = all.slice(0, n)
  const tail = all.slice(n)
  const rest = tail.length
    ? {
        devs: tail.length,
        commits: tail.reduce((s, r) => s + r.commits, 0),
        prs: tail.reduce((s, r) => s + r.prs, 0),
      }
    : null
  return { rows, rest }
}

// ---------------------------------------------------------------------------
// mix de tipos no período (fatia única) — agrupa pela taxonomia exibida
// ---------------------------------------------------------------------------
export interface TypeMixRow {
  type: CommitType
  commits: number
  /** % do total, 1 casa decimal (mesma precisão do mix por repo) */
  pct: number
}

export function typeMix(rows: readonly { type: string, commits: number }[]): TypeMixRow[] {
  const totals = new Map<CommitType, number>()
  for (const r of rows) {
    const t = commitTypeGroup(r.type)
    totals.set(t, (totals.get(t) ?? 0) + r.commits)
  }
  const total = [...totals.values()].reduce((s, v) => s + v, 0)
  return COMMIT_TYPES
    .map(type => ({ type, commits: totals.get(type) ?? 0, pct: total > 0 ? Math.round(((totals.get(type) ?? 0) / total) * 1000) / 10 : 0 }))
    .filter(r => r.commits > 0)
    .sort((a, b) => b.commits - a.commits || COMMIT_TYPES.indexOf(a.type) - COMMIT_TYPES.indexOf(b.type))
}

// ---------------------------------------------------------------------------
// fora do horário agregado do time numa janela de semanas (fds + madrugada)
// ---------------------------------------------------------------------------
export interface OffHoursShare {
  weekend: number
  night: number
  total: number
  /** (weekend + night) / total — 0 sem commits na janela */
  pct: number
}

/**
 * Fração de commits fora do horário na janela — SOMA TODOS os commits da
 * janela no denominador (o `burnout` filtra devs sem fora-do-horário, o que
 * inflaria a fração do time).
 */
export function offHoursShare(
  rows: readonly { week: string, commits: number, weekend: number, night: number }[],
  weeks: readonly string[],
): OffHoursShare {
  const inWindow = new Set(weeks)
  let weekend = 0
  let night = 0
  let total = 0
  for (const r of rows) {
    if (!inWindow.has(r.week))
      continue
    weekend += r.weekend
    night += r.night
    total += r.commits
  }
  return { weekend, night, total, pct: total > 0 ? (weekend + night) / total : 0 }
}
