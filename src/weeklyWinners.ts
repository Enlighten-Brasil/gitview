/**
 * Campeão da semana por EVOLUÇÃO (issue #10) — fórmula extraída do
 * WeeklyChampions.vue para servir também ao Pulso do time (Visão geral),
 * sem duplicar a regra. PURO: recebe as linhas já filtradas + predicado de
 * período (o componente injeta `inPeriodMonth`).
 *
 * Vitória = maior `commits / (média das BASELINE_WEEKS semanas anteriores +
 * 1)` na semana, com piso de MIN_WEEK_COMMITS commits para matar o ruído de
 * médias pequenas. O "+1" no denominador dá às 2× a quem começa do zero —
 * quem volta de férias vence uma semana, não o placar inteiro.
 * A janela de baseline é calendário (follow-up #12): as N semanas ISO
 * anteriores, com semana vazia contando 0. Issue #25: a janela só considera
 * semanas DENTRO do período filtrado — semana sem nenhuma semana anterior no
 * período fica de fora do ranking (baseline 0 viraria volume puro).
 */
import type { WeeklyRow } from './types'
import { nestBySum } from './aggregations'
import { isoWeekKeyBefore } from './date'

export const MIN_WEEK_COMMITS = 3
export const BASELINE_WEEKS = 8

export interface WeeklyWin {
  week: string
  author: string
  commits: number
  ratio: number
}

export interface WeeklyWinners {
  /** vitórias em ordem cronológica (a UI inverte p/ mostrar a mais recente) */
  wins: WeeklyWin[]
  /** vitórias por dev — count desc, autor asc */
  titleRank: { author: string, count: number }[]
  weeksWithWins: number
}

export function weeklyWins(
  rows: readonly Pick<WeeklyRow, 'week' | 'author' | 'commits'>[],
  opts: { baselineWeeks?: number, minCommits?: number, isWeekInPeriod?: (week: string) => boolean } = {},
): WeeklyWinners {
  const baselineWeeks = opts.baselineWeeks ?? BASELINE_WEEKS
  const minCommits = opts.minCommits ?? MIN_WEEK_COMMITS
  const inPeriod = opts.isWeekInPeriod ?? (() => true)

  // semana → autor → commits (agregação compartilhada — issue #41)
  const byWeek = nestBySum(rows, r => r.week, r => r.author)

  const weeks = [...byWeek.keys()].sort()
  const wins: WeeklyWin[] = []
  for (let i = 0; i < weeks.length; i++) {
    // janela = as baselineWeeks semanas calendário anteriores que caem DENTRO
    // do período filtrado (issue #25); chave fora do formato "YYYY-Www" só
    // encurta a janela (não deve ocorrer). Sem nenhuma semana anterior no
    // período, a baseline seria 0 — a semana sai do ranking.
    const window: string[] = []
    for (let k = baselineWeeks; k >= 1; k--) {
      const wk = isoWeekKeyBefore(weeks[i], k)
      if (wk && inPeriod(wk))
        window.push(wk)
    }
    if (!window.length)
      continue
    let best: { author: string, commits: number, ratio: number } | null = null
    // semana sempre existe no mapa (weeks vem de byWeek.keys())
    for (const [author, commits] of byWeek.get(weeks[i]) ?? new Map<string, number>()) {
      if (commits < minCommits)
        continue
      const prev = window.reduce((s, w) => s + (byWeek.get(w)?.get(author) ?? 0), 0)
      const ratio = commits / (prev / Math.max(window.length, 1) + 1)
      if (!best || ratio > best.ratio
        || (ratio === best.ratio && (commits > best.commits || (commits === best.commits && author < best.author)))) {
        best = { author, commits, ratio }
      }
    }
    if (best)
      wins.push({ week: weeks[i], ...best })
  }

  // vitórias por dev (todas as semanas do período filtrado)
  const titles = new Map<string, number>()
  for (const w of wins) titles.set(w.author, (titles.get(w.author) ?? 0) + 1)
  const titleRank = [...titles.entries()]
    .map(([author, count]) => ({ author, count }))
    .sort((a, b) => b.count - a.count || a.author.localeCompare(b.author))

  return { wins, titleRank, weeksWithWins: wins.length }
}
