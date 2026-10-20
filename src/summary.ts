/**
 * Resumo semanal exportável (markdown) — última semana ISO fechada (seg–dom)
 * comparada com a anterior. Relatório do time inteiro: ignora os filtros da
 * sidebar e sempre exclui bots. Pensado pra colar em reunião/1:1.
 */
import type { MergedPr } from './types'
import { isBot, isoWeekKey, stats } from './data'
import { daysSince, fmtDate, fmtDateTime, fmtDay, fmtDuration, median } from './format'
import { ghName, github } from './github'
import { releases } from './releases'
import { displayPct } from './risk'
import {
  DEV_STALE_DAYS,
  OFF_HOURS_PCT,
  OFF_HOURS_WEEK_MIN_COMMITS,
  PR_STALE_DAYS,
  REPO_STALE_DAYS,
} from './thresholds'
import { isMergedPr } from './types'

export interface WeeklySummary {
  /** segunda da semana coberta */
  from: Date
  /** domingo 23:59:59 da semana coberta */
  to: Date
  weekKey: string
  markdown: string
}

function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

function inRange(iso: string | null, a: Date, b: Date): boolean {
  if (!iso)
    return false
  const d = new Date(iso)
  return d >= a && d <= b
}

/** delta percentual vs semana anterior; vazio quando não há base */
function delta(cur: number, prev: number): string {
  if (!prev)
    return ''
  const pct = Math.round(((cur - prev) / prev) * 100)
  return ` (${pct >= 0 ? '+' : ''}${pct}% vs semana anterior)`
}

export function buildWeeklySummary(): WeeklySummary | null {
  const s = stats.value
  if (!s)
    return null

  // última semana ISO FECHADA (segunda passada → domingo passado)
  const thisMonday = mondayOf(new Date())
  const from = new Date(thisMonday)
  from.setDate(from.getDate() - 7)
  const to = new Date(thisMonday)
  to.setMilliseconds(-1)
  const prevFrom = new Date(from)
  prevFrom.setDate(prevFrom.getDate() - 7)
  const prevTo = new Date(from)
  prevTo.setMilliseconds(-1)

  const wk = isoWeekKey(from)
  const prevWk = isoWeekKey(prevFrom)
  const out: string[] = []

  // -------------------------------------------------------------------------
  // commits (weekly: week|repo|author com commits/weekend/night)
  // -------------------------------------------------------------------------
  const weekRows = s.weekly.filter(r => r.week === wk && !isBot(r.author))
  const prevWeekRows = s.weekly.filter(r => r.week === prevWk && !isBot(r.author))

  const byAuthor = new Map<string, { commits: number, weekend: number, night: number }>()
  const byRepo = new Map<string, number>()
  for (const r of weekRows) {
    const a = byAuthor.get(r.author) ?? { commits: 0, weekend: 0, night: 0 }
    a.commits += r.commits
    a.weekend += r.weekend
    a.night += r.night
    byAuthor.set(r.author, a)
    byRepo.set(r.repo, (byRepo.get(r.repo) ?? 0) + r.commits)
  }
  const totalCommits = [...byAuthor.values()].reduce((acc, a) => acc + a.commits, 0)
  const prevCommits = prevWeekRows.reduce((acc, r) => acc + r.commits, 0)
  const topDevs = [...byAuthor.entries()].sort((a, b) => b[1].commits - a[1].commits)
  const topRepos = [...byRepo.entries()].sort((a, b) => b[1] - a[1])

  out.push(`# Resumo da semana — ${fmtDay(from)} a ${fmtDate(to)} (${wk})`)
  out.push(`_dados do gitview gerados em ${fmtDateTime(s.generatedAt)}_`)
  out.push('')
  out.push('## Commits')
  out.push(`- **${totalCommits} commits**${delta(totalCommits, prevCommits)}, ${byAuthor.size} devs ativos, ${byRepo.size} repos ativos`)
  if (topDevs.length) {
    out.push(`- top devs: ${topDevs.slice(0, 5).map(([name, a]) => `${name} (${a.commits})`).join(', ')}`)
  }
  if (topRepos.length) {
    out.push(`- repos mais ativos: ${topRepos.slice(0, 5).map(([repo, n]) => `${repo} (${n})`).join(', ')}`)
  }
  out.push('')

  // -------------------------------------------------------------------------
  // pull requests
  // -------------------------------------------------------------------------
  const prs = github.value?.prs ?? []
  const isGhBot = (login: string) => github.value?.users[login]?.bot ?? /bot/i.test(login)
  // narrowing de PR mergeado (issue #42): mergedAt garantido no ciclo
  const merged = prs.filter((pr): pr is MergedPr => isMergedPr(pr) && inRange(pr.mergedAt, from, to) && !isGhBot(pr.author))
  const prevMerged = prs.filter(pr => isMergedPr(pr) && inRange(pr.mergedAt, prevFrom, prevTo) && !isGhBot(pr.author))

  if (prs.length) {
    const cycle = median(merged.map(pr => (new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime()) / 3_600_000))
    const noReview = merged.filter(pr => !pr.reviews.some(r => r.author !== pr.author && !isGhBot(r.author)))
    const noReviewPct = merged.length ? Math.round((noReview.length / merged.length) * 100) : 0
    const open = prs.filter(pr => pr.state === 'OPEN' && !isGhBot(pr.author))
    const stale = open
      .map(pr => ({ pr, age: daysSince(pr.createdAt) }))
      .filter(x => x.age >= PR_STALE_DAYS)
      .sort((a, b) => b.age - a.age)

    const reviews = new Map<string, number>()
    for (const pr of merged) {
      for (const r of pr.reviews) {
        if (r.author === pr.author || isGhBot(r.author))
          continue
        const name = ghName(r.author)
        reviews.set(name, (reviews.get(name) ?? 0) + 1)
      }
    }
    const topReviewers = [...reviews.entries()].sort((a, b) => b[1] - a[1])

    out.push('## Pull requests')
    out.push(`- **${merged.length} mergeados**${delta(merged.length, prevMerged.length)}, cycle time mediano ${fmtDuration(cycle)}`)
    out.push(`- ${open.length} abertos agora, **${stale.length} parados há ${PR_STALE_DAYS}+ dias**${stale.length ? `: ${stale.slice(0, 3).map(x => `${x.pr.repo}#${x.pr.number} (${x.age}d)`).join(', ')}${stale.length > 3 ? '…' : ''}` : ''}`)
    out.push(`- ${noReviewPct}% mergeados sem review${noReview.length ? ` (${noReview.length} ${noReview.length === 1 ? 'PR' : 'PRs'})` : ''}`)
    if (topReviewers.length) {
      out.push(`- top reviewers: ${topReviewers.slice(0, 5).map(([name, n]) => `${name} (${n})`).join(', ')}`)
    }
    out.push('')
  }

  // -------------------------------------------------------------------------
  // releases
  // -------------------------------------------------------------------------
  const relRepos = releases.value?.repos ?? []
  if (relRepos.length) {
    const weekTags = relRepos.flatMap(r =>
      r.tags.filter(t => inRange(t.date, from, to)).map(t => ({ repo: r.repo, ...t })),
    )
    const unreleased = relRepos.filter(r => r.unreleased > 0).sort((a, b) => b.unreleased - a.unreleased)

    out.push('## Releases')
    if (weekTags.length) {
      for (const t of weekTags.sort((a, b) => a.date.localeCompare(b.date))) {
        out.push(`- ${t.repo} **${t.tag}** (${fmtDay(new Date(t.date))}, ${t.commits} commits)`)
      }
    }
    else {
      out.push('- nenhuma release na semana')
    }
    if (unreleased.length) {
      out.push(`- commits não liberados: ${unreleased.slice(0, 5).map(r => `${r.repo} (${r.unreleased})`).join(', ')}`)
    }
    out.push('')
  }

  // -------------------------------------------------------------------------
  // atenção (off-hours na semana, inatividade)
  // -------------------------------------------------------------------------
  const offHours = topDevs
    .map(([author, a]) => ({ author, ...a, pct: a.commits >= OFF_HOURS_WEEK_MIN_COMMITS ? (a.weekend + a.night) / a.commits : 0 }))
    .filter(a => displayPct(a.pct) >= OFF_HOURS_PCT)
    .sort((a, b) => b.pct - a.pct)
  const inactiveDevs = s.perAuthor.filter(a =>
    !isBot(a.author) && daysSince(a.lastCommit) >= DEV_STALE_DAYS,
  )
  const inactiveRepos = s.perRepo.filter(r =>
    daysSince(r.lastCommit) >= REPO_STALE_DAYS,
  )

  if (offHours.length || inactiveDevs.length || inactiveRepos.length) {
    out.push('## Atenção')
    for (const a of offHours) {
      out.push(`- ${a.author}: ${Math.round(a.pct * 100)}% dos commits fora do horário na semana (fds/madrugada)`)
    }
    if (inactiveDevs.length) {
      out.push(`- devs sem commit há ${DEV_STALE_DAYS}+ dias: ${inactiveDevs.map(a => a.author).join(', ')}`)
    }
    if (inactiveRepos.length) {
      out.push(`- repos sem commit há ${REPO_STALE_DAYS}+ dias: ${inactiveRepos.map(r => r.repo).join(', ')}`)
    }
    out.push('')
  }

  return { from, to, weekKey: wk, markdown: out.join('\n') }
}
