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
/** cobertura do github.json em PRs MERGED: [hoje−400d, hoje] — janela fora dela subconta (seção degrada) */
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

/**
 * janela rolante COMPLETA de N dias encerrando agora (chips 7d/30d, issue
 * #177): comparável com a janela anterior de mesmo tamanho — NÃO é "em
 * curso", o delta com rótulo "vs N dias anteriores" é o esperado (o default
 * 7d da página de relatórios existe justamente por dar delta limpo em
 * qualquer dia da semana).
 */
export function rollingWindow(days: number, now: Date = new Date()): ReportWindow {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1)
  return { from, to: new Date(now), inProgress: false }
}

/** janela personalizada YYYY-MM-DD (dia inteiro); termina hoje ou depois = em curso (parcial vs completo enganoso — mesma convenção dos presets em curso) */
export function customWindow(fromIso: string, toIso: string, now: Date = new Date()): ReportWindow {
  const from = new Date(`${fromIso}T00:00:00`)
  const end = new Date(`${toIso}T23:59:59.999`)
  return { from, to: end, inProgress: end >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) }
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

/**
 * rótulo da janela JÁ com preposição (issue #184) — concatenar 'na' + label
 * produziria "na mês". Semana ISO fechada → 'na semana'; mês completo → 'no
 * mês'; rolante (termina em `now`) → 'nos N dias'; custom dia-inteiro → 'no
 * período'. Aplicado nos textos congelados de releases/off-hours.
 */
function windowLabel(from: Date, to: Date): string {
  if (isClosedIsoWeek(from, to))
    return 'na semana'
  if (isFullMonth(from, to))
    return 'no mês'
  if (isMidnight(from) && isMidnight(new Date(to.getTime() + 1)))
    return 'no período'
  return `nos ${Math.round((to.getTime() + 1 - from.getTime()) / DAY_MS)} dias`
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

/** delta absoluto em commits (+N/−N, sinal unicode −) — por dev, % seria enganoso (1→5 = +400%) */
function devDelta(cur: number, before: number): string {
  const d = cur - before
  return d >= 0 ? `+${d}` : `−${-d}`
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
export function buildReport(subject: ReportSubject, from: Date, to: Date, inProgressHint?: boolean, opts?: { people?: boolean }): ReportResult | null {
  const s = stats.value
  if (!s)
    return null
  const names = subjectNames(subject)
  const inSubject = (name: string) => names === null || names.has(name)
  const now = new Date()
  // em curso: o caller pode afirmar (as janelas rolantes 7d/30d da página de
  // relatórios são COMPLETAS e pedem o delta — issue #177); sem hint, qualquer
  // janela que termina hoje é tratada como parcial (parcial vs completo é
  // enganoso — convenção de omitir o comparativo)
  const inProgress = inProgressHint ?? to.getTime() >= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const closedWeek = isClosedIsoWeek(from, to)
  const fullMonth = isFullMonth(from, to)
  const title = `Resumo${closedWeek ? ' da semana' : fullMonth ? ' do mês' : ''}${subjectInfix(subject)}`
    + ` — ${fmtDay(from)} a ${fmtDate(to)}${closedWeek ? ` (${isoWeekKey(from)})` : ''}`
  const dw = deltaWindow(from, to)
  const prev = inProgress ? null : commitAgg(inSubject, dw.from, dw.to)
  const delta = (cur: number, prevValue: number) => (inProgress ? '' : deltaLine(cur, prevValue, dw.label))
  const out: string[] = []

  // agregados ANTES da emissão — a linha de abertura sai antes das seções
  const agg = commitAgg(inSubject, from, to)
  const topDevs = [...agg.byAuthor.entries()].sort((a, b) => b[1].commits - a[1].commits)
  const topRepos = [...agg.byRepo.entries()].sort((a, b) => b[1] - a[1])

  // PRs — degradação por POSIÇÃO (issue #184): o github.json cobre mergedAt em
  // [hoje−400d, hoje]; janela fora da cobertura subconta, então PRs/reviews
  // somem da seção, das linhas por dev e da abertura com UMA nota (vazio ≠ zero)
  const prs = github.value?.prs ?? []
  const coverFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - PR_COVERAGE_DAYS)
  const prsDegraded = !prs.length || dayKey(from) < dayKey(coverFrom) || dayKey(to) > dayKey(now)
  const prInSubject = (pr: PullRequest) => !ghIsBot(pr.author) && inSubject(ghName(pr.author))
  let merged: MergedPr[] = []
  let prevMerged = 0
  let cycle = 0
  const mergedByDev = new Map<string, number>()
  const reviewsByDev = new Map<string, number>()
  if (!prsDegraded) {
    // narrowing de PR mergeado (issue #42): mergedAt garantido no ciclo
    merged = prs.filter((pr): pr is MergedPr => isMergedPr(pr) && inRange(pr.mergedAt, from, to) && prInSubject(pr))
    prevMerged = inProgress ? 0 : prs.filter(pr => isMergedPr(pr) && inRange(pr.mergedAt, dw.from, dw.to) && prInSubject(pr)).length
    cycle = median(merged.map(pr => (new Date(pr.mergedAt).getTime() - new Date(pr.createdAt).getTime()) / 3_600_000))
    for (const pr of merged) {
      const author = ghName(pr.author)
      mergedByDev.set(author, (mergedByDev.get(author) ?? 0) + 1)
    }
    // reviews FEITAS pelo dev (mesma base do "reviews feitas" do assunto dev):
    // qualquer PR mergeado na janela, exceto os do próprio dev
    for (const pr of prs) {
      if (!isMergedPr(pr) || !inRange(pr.mergedAt, from, to) || ghIsBot(pr.author))
        continue
      for (const r of pr.reviews) {
        if (r.author === pr.author || ghIsBot(r.author))
          continue
        const reviewer = ghName(r.author)
        reviewsByDev.set(reviewer, (reviewsByDev.get(reviewer) ?? 0) + 1)
      }
    }
  }

  // releases (só organização/time) — rótulo por formato no texto vazio
  const relRepos = releases.value?.repos ?? []
  const relInScope = relRepos.length > 0 && subject.kind !== 'dev'
  const windowTags = relInScope
    ? relRepos.flatMap(r => r.tags.filter(t => inRange(t.date, from, to)).map(t => ({ repo: r.repo, ...t })))
    : []
  const unreleased = relInScope ? relRepos.filter(r => r.unreleased > 0).sort((a, b) => b.unreleased - a.unreleased) : []

  // -------------------------------------------------------------------------
  // cabeçalho
  // -------------------------------------------------------------------------
  out.push(`# ${title}`)
  out.push(`_dados do gitview gerados em ${fmtDateTime(s.generatedAt)}_`)
  if (inProgress)
    out.push('_janela em curso — sem comparativo_')
  out.push('')

  // -------------------------------------------------------------------------
  // abertura — frase de ata determinística (issue #184); mesmas regras de
  // omissão do motor: sem delta em curso ou base 0, PRs/cycle fora quando
  // degradado, singular/plural como as linhas existentes
  // -------------------------------------------------------------------------
  const opening = [`${agg.total} ${agg.total === 1 ? 'commit' : 'commits'}${delta(agg.total, prev?.total ?? 0)}`]
  if (!prsDegraded) {
    opening.push(`${merged.length} ${merged.length === 1 ? 'PR mergeado' : 'PRs mergeados'}${delta(merged.length, prevMerged)}`)
    opening.push(`cycle time ${fmtDuration(cycle)}`)
  }
  if (relInScope)
    opening.push(`${windowTags.length} ${windowTags.length === 1 ? 'release' : 'releases'}`)
  out.push(opening.join(' · '))
  out.push('')

  // -------------------------------------------------------------------------
  // commits
  // -------------------------------------------------------------------------
  out.push('## Commits')
  out.push(`- **${agg.total} ${agg.total === 1 ? 'commit' : 'commits'}**${delta(agg.total, prev?.total ?? 0)}, ${agg.byAuthor.size} ${agg.byAuthor.size === 1 ? 'dev ativo' : 'devs ativos'}, ${agg.byRepo.size} ${agg.byRepo.size === 1 ? 'repo ativo' : 'repos ativos'}`)
  if (subject.kind === 'dev') {
    // assunto dev mantém o formato atual do bloco de commits
    if (topDevs.length)
      out.push(`- top devs: ${topDevs.slice(0, 5).map(([name, a]) => `${name} (${a.commits})`).join(', ')}`)
  }
  else {
    // uma linha por dev (issue #184): união das duas janelas (quem sumiu
    // aparece com 0 commits e delta negativo), ordenada por commits
    // decrescente, sem teto — delta absoluto; em curso, o traço longo
    const devNames = new Set([...agg.byAuthor.keys(), ...(prev?.byAuthor.keys() ?? [])])
    const devRows = [...devNames]
      .map(name => ({ name, commits: agg.byAuthor.get(name)?.commits ?? 0, before: prev?.byAuthor.get(name)?.commits ?? 0 }))
      .sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name))
    for (const d of devRows) {
      const parts = [`${d.commits} ${d.commits === 1 ? 'commit' : 'commits'} (${inProgress ? '—' : devDelta(d.commits, d.before)})`]
      if (!prsDegraded) {
        // PRs/reviews absolutos; omitidos só quando degradado (vazio ≠ zero)
        const pm = mergedByDev.get(d.name) ?? 0
        const rv = reviewsByDev.get(d.name) ?? 0
        parts.push(`${pm} ${pm === 1 ? 'PR mergeado' : 'PRs mergeados'}`)
        parts.push(`${rv} ${rv === 1 ? 'review' : 'reviews'}`)
      }
      out.push(`- ${d.name}: ${parts.join(' · ')}`)
    }
    if (subject.kind === 'org') {
      // bloco de times (issue #185) — só assunto org: uma linha por time na
      // ordem do team.json, 'sem time' sempre presente (0 é dado, não ausência)
      // e rodapé fixo de sobreposição. PRs por time contam o author já resolvido
      // por ghName (o login cru do github.json zeraria a coluna); degradado, só
      // commits — a nota única da seção de PRs cobre o resto
      const teamList = team.value?.teams ?? []
      const inAnyTeam = (name: string) => teamList.some(t => t.members.includes(name))
      const teamCounts = (inTeam: (name: string) => boolean): string => {
        let commits = 0
        let teamPrs = 0
        for (const [name, a] of agg.byAuthor) {
          if (inTeam(name))
            commits += a.commits
        }
        // merged já vem filtrado à janela com bots fora (vazio quando degradado)
        for (const pr of merged) {
          if (inTeam(ghName(pr.author)))
            teamPrs++
        }
        return `${commits} ${commits === 1 ? 'commit' : 'commits'}${prsDegraded ? '' : ` · ${teamPrs} ${teamPrs === 1 ? 'PR mergeado' : 'PRs mergeados'}`}`
      }
      for (const t of teamList)
        out.push(`- ${t.name}: ${teamCounts(n => t.members.includes(n))}`)
      out.push(`- sem time: ${teamCounts(n => !inAnyTeam(n))}`)
      // ponytail: rodapé fixo (texto congelado da spec, sem contagem dinâmica)
      // — upgrade = contar os devs em >1 time se o texto variável voltar a ser pedido
      out.push('- times podem sobrepor (um dev pode estar em mais de um time) — a soma das linhas excede o total da org')
    }
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
  if (prs.length) {
    out.push('## Pull requests')
    if (prsDegraded) {
      out.push('- sem dados de PRs nesta janela')
      out.push('')
    }
    else {
      const noReview = merged.filter(pr => !pr.reviews.some(r => r.author !== pr.author && !ghIsBot(r.author)))
      const noReviewPct = merged.length ? Math.round((noReview.length / merged.length) * 100) : 0
      const open = prs.filter(pr => pr.state === 'OPEN' && prInSubject(pr))
      const stale = open
        .map(pr => ({ pr, age: daysSince(pr.createdAt) }))
        .filter(x => x.age >= PR_STALE_DAYS)
        .sort((a, b) => b.age - a.age)

      out.push(`- **${merged.length} ${merged.length === 1 ? 'mergeado' : 'mergeados'}**${delta(merged.length, prevMerged)}, cycle time mediano (janela do relatório) ${fmtDuration(cycle)}`)
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
        // top reviewers = reviews RECEBIDAS nos PRs do assunto (semântica da
        // seção — difere do "reviews feitas" das linhas por dev)
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
  if (relInScope) {
    // ponytail: releases não têm dimensão de autor (RepoReleases = repo/tags/
    // unreleased) — upgrade = tags dos repos onde o dev tem commits no período
    out.push('## Releases')
    if (windowTags.length) {
      for (const t of windowTags.sort((a, b) => a.date.localeCompare(b.date))) {
        out.push(`- ${t.repo} **${t.tag}** (${fmtDay(new Date(t.date))}, ${t.commits} ${t.commits === 1 ? 'commit' : 'commits'})`)
      }
    }
    else {
      out.push(`- nenhuma release ${windowLabel(from, to)}`)
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
  // opt-in de pessoas (issue #187): as linhas que nomeiam devs (off-hours % e
  // inativos) só saem com `people: true` (default OFF); repos stale é higiene
  // de repo e permanece no default. O resumo semanal liga explicitamente —
  // artefato interno de reunião, a seção é conteúdo dele.
  const people = opts?.people === true

  if ((people && (offHours.length || inactiveDevs.length)) || inactiveRepos.length) {
    out.push('## Atenção')
    if (people) {
      for (const a of offHours) {
        out.push(`- ${a.author}: ${Math.round(a.pct * 100)}% dos commits fora do horário ${windowLabel(from, to)} (fds/madrugada)`)
      }
      if (inactiveDevs.length) {
        out.push(`- devs sem commit há ${DEV_STALE_DAYS}+ dias: ${inactiveDevs.map(a => a.author).join(', ')}`)
      }
    }
    if (inactiveRepos.length) {
      out.push(`- repos sem commit há ${REPO_STALE_DAYS}+ dias: ${inactiveRepos.map(r => r.repo).join(', ')}`)
    }
    // janela fixa "até hoje" rotulada no rodapé (convenção do AGENTS.md)
    out.push('- (até hoje, independe do período)')
    if (people) {
      // rodapé fixo da opt-in (rótulo congelado da spec #187)
      out.push('- métricas de pessoas — não incluir em relatórios para fora do time')
    }
    out.push('')
  }

  return { markdown: out.join('\n'), from, to, title }
}
