/**
 * Motor puro dos relatórios exportáveis (markdown) — issue #176.
 *
 * `buildReport(assunto, de, até)` monta o markdown de qualquer assunto
 * (organização | time | dev) em qualquer janela, lendo só os payloads dos
 * loaders (stats/github/releases/daily/team) — NUNCA o estado reativo de
 * `filters` (a rota de relatórios é `filters: 'none'`; ler o período residual
 * do dashboard misturaria duas semânticas de período no mesmo relatório).
 *
 * `presetWindow` é a função PURA preset→janela (os chips da página de
 * relatórios da onda 3 só mapeiam pra cá). `buildWeeklySummary` (./summary) é
 * o wrapper do preset "semana fechada × organização" — direção única de
 * import: este módulo NUNCA importa ./summary.
 */
import type { DailyRow, MergedPr, PullRequest } from './types'
import { daily } from './daily'
import { isBot, isoWeekKey, isoWeekMonday, stats } from './data'
import { daysSince, fmtDate, fmtDateTime, fmtDay, fmtDuration, median } from './format'
import { ghIsBot, ghName, github } from './github'
import { releases } from './releases'
import { displayPct } from './risk'
import { team } from './team'
import {
  DEV_STALE_DAYS,
  OFF_HOURS_PCT,
  OFF_HOURS_WEEK_MIN_COMMITS,
  PR_STALE_DAYS,
  REPO_STALE_DAYS,
} from './thresholds'
import { isMergedPr } from './types'

const DAY_MS = 86_400_000
/** o github.json cobre PRs MERGED dos últimos 400d — janela maior subconta (seção degrada) */
const PR_COVERAGE_DAYS = 400

/** assunto do relatório — organização inteira, um time (membros do team.json) ou um dev */
export type ReportSubject
  = | { kind: 'org' }
    | { kind: 'team', team: string }
    | { kind: 'dev', dev: string }

export interface ReportResult {
  markdown: string
  from: Date
  to: Date
  /** H1 do markdown sem o `#` — título curto da UI/filename (onda 3) */
  title: string
}

export type ReportPreset = 'last-week' | 'this-week' | 'last-month' | 'this-month'

export interface ReportWindow {
  from: Date
  to: Date
  /** preset em curso (nesta semana/neste mês) — o delta é omitido */
  inProgress: boolean
}

// ---------------------------------------------------------------------------
// janelas
// ---------------------------------------------------------------------------
/** segunda (00:00 local) da semana de `d` */
function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

/** pura: preset do chip → janela (fechada ou em curso) — coberta pelo check:report */
export function presetWindow(preset: ReportPreset, now: Date = new Date()): ReportWindow {
  const monday = mondayOf(now)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  if (preset === 'this-week')
    return { from: monday, to: new Date(now), inProgress: true }
  if (preset === 'this-month')
    return { from: monthStart, to: new Date(now), inProgress: true }
  if (preset === 'last-week') {
    const from = new Date(monday)
    from.setDate(from.getDate() - 7)
    const to = new Date(monday)
    to.setMilliseconds(-1)
    return { from, to, inProgress: false }
  }
  // last-month: mês calendário anterior completo (dia 1 00:00 → último 23:59:59.999)
  const to = new Date(monthStart)
  to.setMilliseconds(-1)
  const from = new Date(monthStart)
  from.setMonth(from.getMonth() - 1)
  return { from, to, inProgress: false }
}

function isMidnight(d: Date): boolean {
  return d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0 && d.getMilliseconds() === 0
}

/** semana ISO fechada exata (seg 00:00 → dom 23:59:59.999)? */
function isClosedIsoWeek(from: Date, to: Date): boolean {
  const next = new Date(to.getTime() + 1)
  return from.getDay() === 1 && isMidnight(from) && isMidnight(next) && next.getTime() - from.getTime() === 7 * DAY_MS
}

/** mês calendário completo (dia 1 00:00 → último 23:59:59.999 do próprio mês)? */
function isFullMonth(from: Date, to: Date): boolean {
  const next = new Date(to.getTime() + 1)
  if (from.getDate() !== 1 || !isMidnight(from) || !isMidnight(next))
    return false
  return next.getTime() === new Date(from.getFullYear(), from.getMonth() + 1, 1).getTime()
}

interface DeltaWindow {
  from: Date
  to: Date
  label: string
}

/**
 * janela anterior imediata encostada em `from` + rótulo por formato: semana
 * ISO fechada → "vs semana anterior"; mês calendário completo → "vs mês
 * anterior"; senão "vs N dias anteriores (DD/MM–DD/MM)". O mês anterior é
 * resolvido no calendário (meses têm tamanhos diferentes — deslocar o mesmo
 * tamanho em ms pousaria no mês errado).
 */
function deltaWindow(from: Date, to: Date): DeltaWindow {
  if (isClosedIsoWeek(from, to)) {
    const prevFrom = new Date(from)
    prevFrom.setDate(prevFrom.getDate() - 7)
    return { from: prevFrom, to: new Date(from.getTime() - 1), label: 'vs semana anterior' }
  }
  if (isFullMonth(from, to)) {
    return {
      from: new Date(from.getFullYear(), from.getMonth() - 1, 1),
      to: new Date(from.getTime() - 1),
      label: 'vs mês anterior',
    }
  }
  const days = Math.round((to.getTime() + 1 - from.getTime()) / DAY_MS)
  const prevFrom = new Date(from.getTime() - days * DAY_MS)
  const prevTo = new Date(from.getTime() - 1)
  return { from: prevFrom, to: prevTo, label: `vs ${days} dias anteriores (${fmtDay(prevFrom)}–${fmtDay(prevTo)})` }
}

/** delta % com rótulo; base 0 → sem delta (padrão do resumo semanal) */
function deltaLine(cur: number, prev: number, label: string): string {
  if (!prev)
    return ''
  const pct = Math.round(((cur - prev) / prev) * 100)
  return ` (${pct >= 0 ? '+' : ''}${pct}% ${label})`
}

// ---------------------------------------------------------------------------
// commits — daily (dia-preciso) ou fallback stats.weekly
// ---------------------------------------------------------------------------
function inRange(iso: string | null, a: Date, b: Date): boolean {
  if (!iso)
    return false
  const d = new Date(iso)
  return d >= a && d <= b
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** dia canônico local YYYY-MM-DD (mesma granularidade do daily.json) */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

/** dia YYYY-MM-DD pelas partes UTC (a chave de semana ISO é UTC) */
function utcDay(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

interface AuthorAgg {
  commits: number
  weekend: number
  night: number
}

interface WindowAgg {
  byAuthor: Map<string, AuthorAgg>
  byRepo: Map<string, number>
  total: number
  additions: number
  deletions: number
  prodCommits: number
  progressCommits: number
  /** daily.json presente? (quebra de escopo e linha de +/− só existem com ele) */
  hasDaily: boolean
}

/**
 * commits da janela já no escopo do assunto (bots sempre fora). Com daily:
 * corte dia-preciso + linhas +/− e quebra prod/progresso (encoding omit-prod
 * src/types.ts:9-16). Sem daily (coleta anterior à issue #175): commits
 * somados das linhas do stats.weekly cuja chave de semana INTERSECTA a janela
 * — na semana fechada o resultado é idêntico ao corte dia-preciso.
 */
function commitAgg(inSubject: (name: string) => boolean, from: Date, to: Date): WindowAgg {
  const agg: WindowAgg = {
    byAuthor: new Map(),
    byRepo: new Map(),
    total: 0,
    additions: 0,
    deletions: 0,
    prodCommits: 0,
    progressCommits: 0,
    hasDaily: daily.value !== null,
  }
  const add = (author: string, repo: string, commits: number, weekend: number, night: number) => {
    const a = agg.byAuthor.get(author) ?? { commits: 0, weekend: 0, night: 0 }
    a.commits += commits
    a.weekend += weekend
    a.night += night
    agg.byAuthor.set(author, a)
    agg.byRepo.set(repo, (agg.byRepo.get(repo) ?? 0) + commits)
    agg.total += commits
  }
  const rows: DailyRow[] | null = daily.value
  if (rows) {
    const [a, b] = [dayKey(from), dayKey(to)]
    for (const r of rows) {
      if (r.day < a || r.day > b || isBot(r.author) || !inSubject(r.author))
        continue
      add(r.author, r.repo, r.commits, r.weekend, r.night)
      agg.additions += r.additions
      agg.deletions += r.deletions
      // omit-prod: linha SEM scope = produção; com scope = progresso
      if (r.scope)
        agg.progressCommits += r.commits
      else
        agg.prodCommits += r.commits
    }
    return agg
  }
  const [fromDay, toDay] = [dayKey(from), dayKey(to)]
  for (const r of stats.value?.weekly ?? []) {
    if (isBot(r.author) || !inSubject(r.author))
      continue
    const monday = isoWeekMonday(r.week)
    if (!monday)
      continue
    if (utcDay(monday) > toDay || utcDay(new Date(monday.getTime() + 6 * DAY_MS)) < fromDay)
      continue
    add(r.author, r.repo, r.commits, r.weekend, r.night)
  }
  return agg
}

// ---------------------------------------------------------------------------
// assunto
// ---------------------------------------------------------------------------
/** nomes canônicos do assunto (null = organização inteira) */
function subjectNames(subject: ReportSubject): Set<string> | null {
  if (subject.kind === 'org')
    return null
  if (subject.kind === 'dev')
    return new Set([subject.dev])
  return new Set(team.value?.teams.find(t => t.name === subject.team)?.members ?? [])
}

function subjectInfix(subject: ReportSubject): string {
  return subject.kind === 'org' ? '' : ` · ${subject.kind === 'team' ? subject.team : subject.dev}`
}

// ---------------------------------------------------------------------------
// buildReport
// ---------------------------------------------------------------------------
export function buildReport(subject: ReportSubject, from: Date, to: Date): ReportResult | null {
  const s = stats.value
  if (!s)
    return null
  const names = subjectNames(subject)
  const inSubject = (name: string) => names === null || names.has(name)
  const now = new Date()
  // preset em curso (ou qualquer janela que termina hoje): parcial vs completo
  // é enganoso — o delta sai com a nota no cabeçalho (convenção de omitir)
  const inProgress = to.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const closedWeek = isClosedIsoWeek(from, to)
  const fullMonth = isFullMonth(from, to)
  const title = `Resumo${closedWeek ? ' da semana' : fullMonth ? ' do mês' : ''}${subjectInfix(subject)}`
    + ` — ${fmtDay(from)} a ${fmtDate(to)}${closedWeek ? ` (${isoWeekKey(from)})` : ''}`
  const dw = deltaWindow(from, to)
  const prev = inProgress ? null : commitAgg(inSubject, dw.from, dw.to)
  const delta = (cur: number, prevValue: number) => (inProgress ? '' : deltaLine(cur, prevValue, dw.label))
  const out: string[] = []

  // -------------------------------------------------------------------------
  // cabeçalho
  // -------------------------------------------------------------------------
  out.push(`# ${title}`)
  out.push(`_dados do gitview gerados em ${fmtDateTime(s.generatedAt)}_`)
  if (inProgress)
    out.push('_janela em curso — sem comparativo_')
  out.push('')

  // -------------------------------------------------------------------------
  // commits
  // -------------------------------------------------------------------------
  const agg = commitAgg(inSubject, from, to)
  const topDevs = [...agg.byAuthor.entries()].sort((a, b) => b[1].commits - a[1].commits)
  const topRepos = [...agg.byRepo.entries()].sort((a, b) => b[1] - a[1])
  out.push('## Commits')
  out.push(`- **${agg.total} ${agg.total === 1 ? 'commit' : 'commits'}**${delta(agg.total, prev?.total ?? 0)}, ${agg.byAuthor.size} ${agg.byAuthor.size === 1 ? 'dev ativo' : 'devs ativos'}, ${agg.byRepo.size} ${agg.byRepo.size === 1 ? 'repo ativo' : 'repos ativos'}`)
  if (topDevs.length) {
    out.push(`- top devs: ${topDevs.slice(0, 5).map(([name, a]) => `${name} (${a.commits})`).join(', ')}`)
  }
  if (topRepos.length) {
    out.push(`- repos mais ativos: ${topRepos.slice(0, 5).map(([repo, n]) => `${repo} (${n})`).join(', ')}`)
  }
  if (agg.hasDaily) {
    // linhas +/− com a quebra prod/progresso na MESMA linha nova (byte-compare
    // old vs new: único delta de conteúdo aceito no artefato semanal)
    out.push(`- diff: +${agg.additions}/-${agg.deletions} (prod ${agg.prodCommits} · progresso ${agg.progressCommits} commits)`)
  }
  else {
    out.push('- sem daily.json — recolete para precisão diária')
  }
  out.push('')

  // -------------------------------------------------------------------------
  // pull requests
  // -------------------------------------------------------------------------
  const prs = github.value?.prs ?? []
  if (prs.length) {
    out.push('## Pull requests')
    if (to.getTime() + 1 - from.getTime() > PR_COVERAGE_DAYS * DAY_MS) {
      // github.json só cobre 400d de MERGED — janela maior subconta por design
      out.push('- sem dados de PRs nesta janela')
      out.push('')
    }
    else {
      const prInSubject = (pr: PullRequest) => !ghIsBot(pr.author) && inSubject(ghName(pr.author))
      // narrowing de PR mergeado (issue #42): mergedAt garantido no ciclo
      const merged = prs.filter((pr): pr is MergedPr => isMergedPr(pr) && inRange(pr.mergedAt, from, to) && prInSubject(pr))
      const prevMerged = inProgress ? 0 : prs.filter(pr => isMergedPr(pr) && inRange(pr.mergedAt, dw.from, dw.to) && prInSubject(pr)).length
      const cycle = median(merged.map(pr => (new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime()) / 3_600_000))
      const noReview = merged.filter(pr => !pr.reviews.some(r => r.author !== pr.author && !ghIsBot(r.author)))
      const noReviewPct = merged.length ? Math.round((noReview.length / merged.length) * 100) : 0
      const open = prs.filter(pr => pr.state === 'OPEN' && prInSubject(pr))
      const stale = open
        .map(pr => ({ pr, age: daysSince(pr.createdAt) }))
        .filter(x => x.age >= PR_STALE_DAYS)
        .sort((a, b) => b.age - a.age)

      out.push(`- **${merged.length} ${merged.length === 1 ? 'mergeado' : 'mergeados'}**${delta(merged.length, prevMerged)}, cycle time mediano ${fmtDuration(cycle)}`)
      out.push(`- ${open.length} ${open.length === 1 ? 'aberto agora' : 'abertos agora'}, **${stale.length} ${stale.length === 1 ? 'parado' : 'parados'} há ${PR_STALE_DAYS}+ dias**${stale.length ? `: ${stale.slice(0, 3).map(x => `${x.pr.repo}#${x.pr.number} (${x.age}d)`).join(', ')}${stale.length > 3 ? '…' : ''}` : ''}`)
      out.push(`- ${noReviewPct}% mergeados sem review${noReview.length ? ` (${noReview.length} ${noReview.length === 1 ? 'PR' : 'PRs'})` : ''}`)
      if (subject.kind === 'dev') {
        // assunto dev: sem ranking de reviewers — a métrica do dev é o que ele revisou
        const reviewsMade = prs
          .filter(pr => isMergedPr(pr) && inRange(pr.mergedAt, from, to) && !ghIsBot(pr.author))
          .reduce((n, pr) => n + pr.reviews.filter(r => ghName(r.author) === subject.dev && r.author !== pr.author && !ghIsBot(r.author)).length, 0)
        out.push(`- reviews feitas: ${reviewsMade}`)
      }
      else {
        const reviews = new Map<string, number>()
        for (const pr of merged) {
          for (const r of pr.reviews) {
            if (r.author === pr.author || ghIsBot(r.author))
              continue
            const name = ghName(r.author)
            reviews.set(name, (reviews.get(name) ?? 0) + 1)
          }
        }
        const topReviewers = [...reviews.entries()].sort((a, b) => b[1] - a[1])
        if (topReviewers.length) {
          out.push(`- top reviewers: ${topReviewers.slice(0, 5).map(([name, n]) => `${name} (${n})`).join(', ')}`)
        }
      }
      out.push('')
    }
  }

  // -------------------------------------------------------------------------
  // releases (só organização/time)
  // -------------------------------------------------------------------------
  const relRepos = releases.value?.repos ?? []
  if (relRepos.length && subject.kind !== 'dev') {
    // ponytail: releases não têm dimensão de autor (RepoReleases = repo/tags/
    // unreleased) — upgrade = tags dos repos onde o dev tem commits no período
    const windowTags = relRepos.flatMap(r =>
      r.tags.filter(t => inRange(t.date, from, to)).map(t => ({ repo: r.repo, ...t })),
    )
    const unreleased = relRepos.filter(r => r.unreleased > 0).sort((a, b) => b.unreleased - a.unreleased)

    out.push('## Releases')
    if (windowTags.length) {
      for (const t of windowTags.sort((a, b) => a.date.localeCompare(b.date))) {
        out.push(`- ${t.repo} **${t.tag}** (${fmtDay(new Date(t.date))}, ${t.commits} ${t.commits === 1 ? 'commit' : 'commits'})`)
      }
    }
    else {
      // ponytail: texto herdado do resumo semanal diz "semana" em qualquer
      // janela — rótulo por formato quando alguém pedir (byte-compare: string frozen)
      out.push('- nenhuma release na semana')
    }
    if (unreleased.length) {
      out.push(`- commits não liberados: ${unreleased.slice(0, 5).map(r => `${r.repo} (${r.unreleased})`).join(', ')}`)
    }
    out.push('')
  }

  // -------------------------------------------------------------------------
  // atenção (off-hours dia-preciso do daily + inatividade medida até hoje)
  // -------------------------------------------------------------------------
  const offHours = topDevs
    .map(([author, a]) => ({ author, ...a, pct: a.commits >= OFF_HOURS_WEEK_MIN_COMMITS ? (a.weekend + a.night) / a.commits : 0 }))
    .filter(a => displayPct(a.pct) >= OFF_HOURS_PCT)
    .sort((a, b) => b.pct - a.pct)
  const inactiveDevs = s.perAuthor.filter(a =>
    !isBot(a.author) && inSubject(a.author) && daysSince(a.lastCommit) >= DEV_STALE_DAYS,
  )
  // repos stale são visão de organização/time — o dev não "detém" repo
  const inactiveRepos = subject.kind === 'dev'
    ? []
    : s.perRepo.filter(r => daysSince(r.lastCommit) >= REPO_STALE_DAYS)

  if (offHours.length || inactiveDevs.length || inactiveRepos.length) {
    out.push('## Atenção')
    for (const a of offHours) {
      // ponytail: "na semana" é o texto do artefato herdado — vale para a
      // janela do cabeçalho; rótulo por formato quando alguém pedir
      out.push(`- ${a.author}: ${Math.round(a.pct * 100)}% dos commits fora do horário na semana (fds/madrugada)`)
    }
    if (inactiveDevs.length) {
      out.push(`- devs sem commit há ${DEV_STALE_DAYS}+ dias: ${inactiveDevs.map(a => a.author).join(', ')}`)
    }
    if (inactiveRepos.length) {
      out.push(`- repos sem commit há ${REPO_STALE_DAYS}+ dias: ${inactiveRepos.map(r => r.repo).join(', ')}`)
    }
    // janela fixa "até hoje" rotulada no rodapé (convenção do AGENTS.md)
    out.push('- (até hoje, independe do período)')
    out.push('')
  }

  return { markdown: out.join('\n'), from, to, title }
}
