/**
 * Gate do motor de relatórios (issue #176) — `node:assert` + fixture sintética
 * INLINE (nomes genéricos: o check:scrub varre arquivos tracked) e relógio
 * pinado. CI-safe: NÃO lê public/data/ (diferente do check:data, que fica
 * fora do CI de propósito — os JSONs só existem depois de uma coleta local).
 *
 *   pnpm check:report
 *
 * Cobre: preset→janela (função pura exportada), janelas rolantes 7d/30d e
 * personalizada (chips da página de relatórios), buildReport nos 3 assuntos ×
 * amostra de janelas, linhas por dev com delta absoluto (união das janelas),
 * abertura (frase de ata), rótulos por formato (windowLabel), delta (rótulos
 * por formato, omissão em curso, base 0), degradação de PRs por posição da
 * cobertura [hoje−400d, hoje], linhas por time no assunto org, opt-in de
 * pessoas (default OFF × people), fallback sem daily.json (parity com o
 * corte dia-preciso na semana fechada), a pureza de report.ts (sem import de
 * filters) e o renderer de markdown (escape-first). Qualquer asserção violada → exit 1 com a mensagem no stderr.
 */
import type { DailyRow, GitHubData, PrReview, PullRequest, ReleasesData, Stats, TeamData } from '../src/types'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { daily, stats } from '../src/data'
import { fmtDate, fmtDay } from '../src/format'
import { github } from '../src/github'
import { releases } from '../src/releases'
import { buildReport, customWindow, presetWindow, rollingWindow } from '../src/report'
import { buildWeeklySummary } from '../src/summary'
import { team } from '../src/team'

/**
 * Pina o relógio global (protocolo de scripts/snapshot-metrics.ts): `new
 * Date()` sem argumentos e `Date.now()` devolvem o instante fixo; construções
 * com argumentos seguem o comportamento real — é tudo o que o motor e
 * `daysSince` precisam para o gate não depender do dia da execução.
 */
function pinDate(ms: number): void {
  const RealDate = globalThis.Date
  class PinnedDate extends RealDate {
    constructor(...args: never[]) {
      if (args.length === 0) {
        super(ms)
      }
      else {
        // @ts-expect-error repassa os argumentos originais do construtor Date
        super(...args)
      }
    }

    static now(): number {
      return ms
    }
  }
  globalThis.Date = PinnedDate as unknown as DateConstructor
}

// ---------------------------------------------------------------------------
// fixture sintética (nomes genéricos) — semana W41 = 05/10–11/10/2026
// ---------------------------------------------------------------------------
const NOW = new Date(2026, 9, 15, 12, 0, 0, 0) // quinta; relógio pinado abaixo

const DAILY: DailyRow[] = [
  { day: '2026-10-05', repo: 'demo-api', author: 'Ana', commits: 1, additions: 10, deletions: 2, weekend: 0, night: 0 },
  { day: '2026-10-06', repo: 'demo-web', author: 'Beto', commits: 1, additions: 3, deletions: 1, weekend: 0, night: 0, scope: 'integration' },
  { day: '2026-10-08', repo: 'demo-api', author: 'Ana', commits: 2, additions: 5, deletions: 1, weekend: 0, night: 2 },
  { day: '2026-10-09', repo: 'demo-api', author: 'CI Bot', commits: 9, additions: 90, deletions: 9, weekend: 0, night: 0 },
  { day: '2026-10-10', repo: 'demo-api', author: 'Ana', commits: 2, additions: 2, deletions: 0, weekend: 2, night: 0 },
  { day: '2026-10-13', repo: 'demo-api', author: 'Ana', commits: 2, additions: 4, deletions: 1, weekend: 0, night: 0 },
  // night alto em setembro: dá base ao off-hours do mês (rótulo 'no mês')
  { day: '2026-09-29', repo: 'demo-api', author: 'Ana', commits: 3, additions: 6, deletions: 2, weekend: 0, night: 3 },
  { day: '2026-09-21', repo: 'demo-api', author: 'Ana', commits: 4, additions: 8, deletions: 3, weekend: 0, night: 0 },
  { day: '2026-08-10', repo: 'demo-api', author: 'Ana', commits: 2, additions: 4, deletions: 1, weekend: 0, night: 0 },
  // linha distante: dá base ao delta da janela > 400d (senão base 0 = sem delta)
  { day: '2025-01-15', repo: 'demo-api', author: 'Ana', commits: 1, additions: 2, deletions: 1, weekend: 0, night: 0 },
]

const STATS: Stats = {
  generatedAt: '2026-10-15T12:00:00.000Z',
  repos: ['demo-api', 'demo-web'],
  authors: [
    { name: 'Ana', emails: [], bot: false },
    { name: 'Beto', emails: [], bot: false },
    { name: 'CI Bot', emails: [], bot: true },
  ],
  totals: { commits: 25, prodCommits: 20, progressCommits: 5, additions: 100, deletions: 30, activeDays: 9, repos: 2, authors: 3 },
  perRepo: [
    { repo: 'demo-api', commits: 24, prodCommits: 20, progressCommits: 4, additions: 90, deletions: 25, authors: 2, lastCommit: '2026-10-13T12:00:00.000Z' },
    { repo: 'demo-web', commits: 1, prodCommits: 0, progressCommits: 1, additions: 10, deletions: 5, authors: 1, lastCommit: '2026-06-01T12:00:00.000Z' },
  ],
  perAuthor: [
    { author: 'Ana', commits: 20, additions: 80, deletions: 20, repos: 1, activeDays: 7, lastCommit: '2026-10-13T12:00:00.000Z', streak: 3, longestStreak: 4 },
    { author: 'Beto', commits: 4, additions: 15, deletions: 8, repos: 1, activeDays: 3, lastCommit: '2026-09-01T12:00:00.000Z', streak: 0, longestStreak: 1 },
    { author: 'CI Bot', commits: 1, additions: 5, deletions: 2, repos: 1, activeDays: 1, lastCommit: '2026-10-09T12:00:00.000Z', streak: 1, longestStreak: 1 },
  ],
  // fallback stats.weekly: mesma semana fechada + vizinhas (interseção de janela)
  weekly: [
    { week: '2026-W41', repo: 'demo-api', author: 'Ana', commits: 5, weekend: 2, night: 2 },
    { week: '2026-W41', repo: 'demo-web', author: 'Beto', commits: 1, weekend: 0, night: 0, scope: 'integration' },
    { week: '2026-W41', repo: 'demo-api', author: 'CI Bot', commits: 9, weekend: 0, night: 0 },
    { week: '2026-W42', repo: 'demo-api', author: 'Ana', commits: 2, weekend: 0, night: 0 },
    { week: '2026-W40', repo: 'demo-api', author: 'Ana', commits: 3, weekend: 0, night: 3 },
    { week: '2026-W39', repo: 'demo-api', author: 'Ana', commits: 4, weekend: 0, night: 0 },
    { week: '2026-W33', repo: 'demo-api', author: 'Ana', commits: 2, weekend: 0, night: 0 },
  ],
  monthly: [],
  heatmap: [],
}

const REVIEWS: Record<string, PrReview> = {
  approvedByBeto: { author: 'beto-login', state: 'APPROVED', submittedAt: '2026-10-05T12:00:00.000Z' },
  commentedByAna: { author: 'ana-login', state: 'COMMENTED', submittedAt: '2026-10-06T12:00:00.000Z' },
  approvedByAna: { author: 'ana-login', state: 'APPROVED', submittedAt: '2026-10-01T12:00:00.000Z' },
}

const PRS: PullRequest[] = [
  { repo: 'demo-api', number: 1, title: 'feat: a', url: 'u1', state: 'MERGED', draft: false, author: 'ana-login', createdAt: '2026-10-01T12:00:00.000Z', mergedAt: '2026-10-06T12:00:00.000Z', additions: 10, deletions: 2, changedFiles: 1, reviews: [REVIEWS.approvedByBeto] },
  { repo: 'demo-web', number: 2, title: 'feat: b', url: 'u2', state: 'MERGED', draft: false, author: 'beto-login', createdAt: '2026-10-08T12:00:00.000Z', mergedAt: '2026-10-09T12:00:00.000Z', additions: 3, deletions: 1, changedFiles: 1, reviews: [] },
  { repo: 'demo-api', number: 3, title: 'chore: bot', url: 'u3', state: 'MERGED', draft: false, author: 'ci-bot', createdAt: '2026-10-06T12:00:00.000Z', mergedAt: '2026-10-07T12:00:00.000Z', additions: 1, deletions: 0, changedFiles: 1, reviews: [] },
  { repo: 'demo-web', number: 4, title: 'fix: c', url: 'u4', state: 'MERGED', draft: false, author: 'beto-login', createdAt: '2026-09-30T12:00:00.000Z', mergedAt: '2026-10-02T12:00:00.000Z', additions: 5, deletions: 5, changedFiles: 2, reviews: [REVIEWS.approvedByAna] },
  { repo: 'demo-api', number: 5, title: 'feat: parado', url: 'u5', state: 'OPEN', draft: false, author: 'ana-login', createdAt: '2026-09-20T12:00:00.000Z', mergedAt: null, additions: 7, deletions: 1, changedFiles: 1, reviews: [] },
  { repo: 'demo-api', number: 6, title: 'chore: bot aberto', url: 'u6', state: 'OPEN', draft: false, author: 'ci-bot', createdAt: '2026-09-18T12:00:00.000Z', mergedAt: null, additions: 1, deletions: 1, changedFiles: 1, reviews: [] },
  { repo: 'demo-web', number: 7, title: 'feat: d', url: 'u7', state: 'MERGED', draft: false, author: 'beto-login', createdAt: '2026-10-05T12:00:00.000Z', mergedAt: '2026-10-10T12:00:00.000Z', additions: 9, deletions: 3, changedFiles: 1, reviews: [REVIEWS.commentedByAna] },
]

const GITHUB: GitHubData = {
  generatedAt: '2026-10-15T12:00:00.000Z',
  users: {
    'ana-login': { name: 'Ana', bot: false },
    'beto-login': { name: 'Beto', bot: false },
    'ci-bot': { name: 'CI Bot', bot: true },
  },
  prs: PRS,
}

const RELEASES_DATA: ReleasesData = {
  generatedAt: '2026-10-15T12:00:00.000Z',
  repos: [
    { repo: 'demo-api', url: null, unreleased: 5, tags: [{ tag: 'v1.0.0', date: '2026-10-06T12:00:00.000Z', commits: 3, name: null, notes: null, prerelease: false, url: null }] },
    { repo: 'demo-web', url: null, unreleased: 0, tags: [] },
  ],
}

const TEAM_DATA: TeamData = {
  generatedAt: '2026-10-15T12:00:00.000Z',
  devs: [
    { name: 'Ana', title: null, description: null, emails: [], githubLogins: ['ana-login'], teams: ['Plataforma'], bot: false },
    { name: 'Beto', title: null, description: null, emails: [], githubLogins: ['beto-login'], teams: [], bot: false },
    { name: 'CI Bot', title: null, description: null, emails: [], githubLogins: ['ci-bot'], teams: [], bot: true },
  ],
  teams: [
    { name: 'Plataforma', description: null, color: null, members: ['Ana'] },
    // time sem membros: cobre a linha de time zerada e a ordem do team.json
    { name: 'Suporte', description: null, color: null, members: [] },
  ],
  candidates: [],
}

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------
let checks = 0
function ok(condition: unknown, message: string): void {
  checks++
  assert.ok(condition, message)
}

try {
  pinDate(NOW.getTime())
  stats.value = STATS
  github.value = GITHUB
  releases.value = RELEASES_DATA
  team.value = TEAM_DATA
  daily.value = DAILY

  // ── preset→janela (função pura; `now` explícito = sem dependência de relógio) ──
  const lw = presetWindow('last-week', NOW)
  ok(lw.from.getTime() === new Date(2026, 9, 5).getTime(), 'last-week: from = segunda da semana passada')
  ok(lw.to.getTime() === new Date(2026, 9, 11, 23, 59, 59, 999).getTime(), 'last-week: to = domingo 23:59:59.999')
  ok(!lw.inProgress, 'last-week: fechada (sem nota em curso)')
  const lm = presetWindow('last-month', NOW)
  ok(lm.from.getTime() === new Date(2026, 8, 1).getTime(), 'last-month: from = dia 1 do mês anterior')
  ok(lm.to.getTime() === new Date(2026, 8, 30, 23, 59, 59, 999).getTime(), 'last-month: to = último dia do mês anterior')
  ok(!lm.inProgress, 'last-month: fechada')
  const tw = presetWindow('this-week', NOW)
  ok(tw.from.getTime() === new Date(2026, 9, 12).getTime() && tw.to.getTime() === NOW.getTime(), 'this-week: segunda → agora')
  ok(tw.inProgress, 'this-week: marcada em curso')
  const tm = presetWindow('this-month', NOW)
  ok(tm.from.getTime() === new Date(2026, 9, 1).getTime() && tm.to.getTime() === NOW.getTime() && tm.inProgress, 'this-month: dia 1 → agora, em curso')

  // ── janelas rolantes completas e personalizada (chips da página de relatórios) ──
  const r7 = rollingWindow(7, NOW)
  ok(r7.from.getTime() === new Date(2026, 9, 9).getTime() && r7.to.getTime() === NOW.getTime(), 'rolling 7d: from = hoje-6 00:00, to = agora')
  ok(!r7.inProgress, 'rolling 7d: completa — delta habilitado (default da página, issue #177)')
  const r30 = rollingWindow(30, NOW)
  ok(r30.from.getTime() === new Date(2026, 8, 16).getTime() && !r30.inProgress, 'rolling 30d: from = hoje-29 00:00, completa')
  const cwClosed = customWindow('2026-10-01', '2026-10-14', NOW)
  ok(cwClosed.to.getTime() === new Date(2026, 9, 14, 23, 59, 59, 999).getTime() && !cwClosed.inProgress, 'custom fechado: to = 23:59:59.999, sem em-curso')
  const cwToday = customWindow('2026-10-01', '2026-10-15', NOW)
  ok(cwToday.inProgress, 'custom terminando hoje: em curso (omite delta)')
  const org7 = buildReport({ kind: 'org' }, r7.from, r7.to, r7.inProgress)!
  ok(/vs 7 dias anteriores \(\d{2}\/\d{2}–\d{2}\/\d{2}\)/.test(org7.markdown), 'hint: 7d leva delta com rótulo "vs 7 dias anteriores"')
  const org7Hint = buildReport({ kind: 'org' }, r7.from, r7.to, true)!
  ok(!org7Hint.markdown.includes('% vs '), 'hint true omite o delta (em curso)')

  // ── organização × semana fechada (caminho do resumo semanal) ──
  const org = buildReport({ kind: 'org' }, lw.from, lw.to, undefined, { people: true })
  ok(org !== null, 'org: buildReport devolve resultado com stats carregados')
  const orgMd = org!.markdown
  ok(org!.title === `Resumo da semana — ${fmtDay(lw.from)} a ${fmtDate(lw.to)} (2026-W41)`, 'org: título com janela e chave ISO da semana')
  ok(orgMd.includes('- **6 commits** (+100% vs semana anterior), 2 devs ativos, 2 repos ativos'), 'org: commits com delta vs semana anterior (daily dia-preciso, bots fora)')
  ok(orgMd.includes('- Ana: 5 commits (+2) · 1 PR mergeado · 1 review'), 'org: linha por dev com commits, delta absoluto, PRs e reviews')
  ok(orgMd.includes('- Beto: 1 commit (+1) · 2 PRs mergeados · 1 review'), 'org: linha por dev singularizada, ordenada por commits')
  ok(!orgMd.includes('top devs'), 'org: ranking top devs substituído pelas linhas por dev')
  ok(orgMd.includes('6 commits (+100% vs semana anterior) · 3 PRs mergeados (+200% vs semana anterior) · cycle time 5,0d · 1 release'), 'org: abertura (frase de ata) na semana fechada')
  ok(orgMd.includes('- repos mais ativos: demo-api (5), demo-web (1)'), 'org: top repos')
  ok(orgMd.includes('- diff: +20/-4 (prod 5 · progresso 1 commits)'), 'org: linha de +/− com quebra prod/progresso (omit-prod)')
  ok(orgMd.includes('- **3 mergeados** (+200% vs semana anterior), cycle time mediano 5,0d'), 'org: PRs mergeados com delta e cycle time mediano')
  ok(orgMd.includes('- 1 aberto agora, **1 parado há 14+ dias**: demo-api#5 (25d)'), 'org: PRs abertos/parados (bots fora)')
  ok(orgMd.includes('- 33% mergeados sem review (1 PR)'), 'org: % de merges sem review')
  ok(orgMd.includes('- top reviewers: Beto (1), Ana (1)'), 'org: top reviewers por nome canônico (ghName do login)')
  ok(orgMd.includes(`- demo-api **v1.0.0** (${fmtDay(new Date('2026-10-06T12:00:00.000Z'))}, 3 commits)`), 'org: release na janela')
  ok(orgMd.includes('- commits não liberados: demo-api (5)'), 'org: commits não liberados')
  ok(orgMd.includes('- Ana: 80% dos commits fora do horário na semana (fds/madrugada)'), 'org: off-hours dia-preciso (fds+madrugada do daily, piso de commits)')
  const atencaoMd = orgMd.slice(orgMd.indexOf('## Atenção'))
  ok(!atencaoMd.includes('Beto: ') && !atencaoMd.includes('- Beto: '), 'org: off-hours respeita o piso de commits (guarda re-scoped ao bloco Atenção — Beto é legitimo nas linhas por dev)')
  ok(orgMd.includes('- devs sem commit há 21+ dias: Beto'), 'org: devs inativos (medidos até hoje)')
  ok(orgMd.includes('- repos sem commit há 30+ dias: demo-web'), 'org: repos stale')
  ok(orgMd.includes('- (até hoje, independe do período)'), 'org: rodapé da inatividade (janela fixa rotulada)')
  ok(!orgMd.includes('CI Bot'), 'org: bot excluído de commits e PRs')

  // ── bloco de times (issue #185) — só assunto org, sob ## Commits ──
  ok(orgMd.includes('- Plataforma: 5 commits · 1 PR mergeado'), 'times: linha por time com PRs resolvidos por ghName (author cru do github.json não zera a coluna)')
  ok(orgMd.includes('- Suporte: 0 commits · 0 PRs mergeados'), 'times: time zerado sai com zeros explícitos (0 é dado, não ausência)')
  ok(orgMd.indexOf('- Plataforma:') < orgMd.indexOf('- Suporte:'), 'times: linhas na ordem do team.json')
  ok(orgMd.includes('- sem time: 1 commit · 2 PRs mergeados'), 'times: sem time = complemento da união dos times, sempre presente')
  ok(orgMd.includes('- times podem sobrepor (um dev pode estar em mais de um time) — a soma das linhas excede o total da org'), 'times: rodapé fixo de sobreposição (texto fixo, genérico — nomes reais de time nunca no repositório)')

  // ── opt-in de pessoas (issue #187): default OFF × people: true ──
  // asserções de default varrem os TEMPLATES das linhas (nomes de dev saem
  // legitimos nas linhas por dev — o que não pode sair sao as linhas de
  // off-hours/inativos que nomeiam gente)
  const orgDefaultMd = buildReport({ kind: 'org' }, lw.from, lw.to)!.markdown
  ok(!orgDefaultMd.includes('fora do horário') && !orgDefaultMd.includes('devs sem commit'), 'pessoas OFF: linhas de off-hours/inativas (nomes de dev) fora por default')
  ok(orgDefaultMd.includes('## Atenção') && orgDefaultMd.includes('- repos sem commit há 30+ dias: demo-web'), 'pessoas OFF: repos stale permanece (higiene de repo, fora do gate de pessoas)')
  ok(!orgDefaultMd.includes('métricas de pessoas'), 'pessoas OFF: sem rodapé de pessoas')
  ok(orgMd.includes('- Ana: 80% dos commits fora do horário na semana (fds/madrugada)') && orgMd.includes('- devs sem commit há 21+ dias: Beto'), 'pessoas ON: seção completa (off-hours + inativos)')
  ok(orgMd.includes('- métricas de pessoas — não incluir em relatórios para fora do time'), 'pessoas ON: rodapé fixo de uso interno')

  // ── time × semana fechada ──
  const teamMd = buildReport({ kind: 'team', team: 'Plataforma' }, lw.from, lw.to, undefined, { people: true })!.markdown
  ok(teamMd.includes('- **5 commits** (+67% vs semana anterior), 1 dev ativo, 1 repo ativo'), 'time: commits só dos membros')
  ok(teamMd.includes('5 commits (+67% vs semana anterior) · 1 PR mergeado · cycle time 5,0d · 1 release'), 'time: abertura na semana fechada')
  ok(teamMd.includes('- Ana: 5 commits (+2) · 1 PR mergeado · 1 review'), 'time: linha por dev só dos membros')
  ok(teamMd.includes('- **1 mergeado**, cycle time mediano 5,0d'), 'time: PRs mergeados por membro; base 0 na semana anterior = sem delta')
  ok(teamMd.includes('- top reviewers: Beto (1)'), 'time: reviews de terceiros nos PRs do time')
  ok(teamMd.includes('## Releases'), 'time: releases entram (só org/time)')
  ok(!teamMd.includes('- devs sem commit há 21+ dias: Beto'), 'time: inatividade filtrada aos membros (Beto não é membro)')
  ok(teamMd.includes('- repos sem commit há 30+ dias: demo-web'), 'time: repos stale valem para time')
  ok(!teamMd.includes('- sem time:') && !teamMd.includes('times podem sobrepor'), 'time: sem bloco de times (o recorte do assunto já é a resposta)')

  // ── dev × semana fechada ──
  const anaMd = buildReport({ kind: 'dev', dev: 'Ana' }, lw.from, lw.to)!.markdown
  ok(anaMd.includes('Resumo da semana · Ana —'), 'dev: assunto no título')
  ok(anaMd.includes('5 commits (+67% vs semana anterior) · 1 PR mergeado · cycle time 5,0d'), 'dev: abertura sem parcela de releases (fora do assunto dev)')
  ok(anaMd.includes('- top devs: Ana (5)'), 'dev: bloco de commits mantém o formato atual (sem a seção nova)')
  ok(anaMd.includes('- **1 mergeado**, cycle time mediano 5,0d'), 'dev: PRs mergeados do dev')
  ok(anaMd.includes('- reviews feitas: 1'), 'dev: top reviewers vira "reviews feitas"')
  ok(!anaMd.includes('## Releases'), 'dev: releases fora do assunto dev')
  ok(!anaMd.includes('repos sem commit'), 'dev: repos stale fora do assunto dev')
  ok(!anaMd.includes('- sem time:') && !anaMd.includes('times podem sobrepor'), 'dev: sem bloco de times')
  const betoMd = buildReport({ kind: 'dev', dev: 'Beto' }, lw.from, lw.to, undefined, { people: true })!.markdown
  ok(betoMd.includes('- **1 commit**, 1 dev ativo, 1 repo ativo'), 'dev: singularização commit/dev/repo')
  ok(betoMd.includes('- **2 mergeados** (+100% vs semana anterior), cycle time mediano 3,0d'), 'dev: cycle time mediano dos PRs do dev')
  ok(betoMd.includes('1 commit · 2 PRs mergeados (+100% vs semana anterior) · cycle time 3,0d'), 'dev: abertura omite o delta em base 0 (1 commit sem comparativo)')
  ok(betoMd.includes('- devs sem commit há 21+ dias: Beto'), 'dev: inatividade do próprio dev')

  // ── delta: rótulos por formato ──
  const monthMd = buildReport({ kind: 'org' }, lm.from, lm.to, undefined, { people: true })!.markdown
  ok(monthMd.includes('- **7 commits** (+250% vs mês anterior), 1 dev ativo, 1 repo ativo'), 'delta: "vs mês anterior" para mês calendário completo')
  ok(monthMd.includes('7 commits (+250% vs mês anterior) · 0 PRs mergeados · cycle time <1h · 0 releases'), 'abertura: mês calendário')
  ok(monthMd.includes('- Ana: 7 commits (+5)'), 'linhas por dev: delta absoluto no mês')
  ok(monthMd.includes('- nenhuma release no mês'), 'rótulo: nenhuma release no formato da janela (no mês)')
  ok(monthMd.includes('- Ana: 43% dos commits fora do horário no mês (fds/madrugada)'), 'rótulo: fora do horário no formato da janela (no mês)')
  ok(monthMd.includes('- sem time: 0 commits · 0 PRs mergeados') && monthMd.includes('times podem sobrepor'), 'times: sem time presente com 0 e rodapé em qualquer janela')
  const w40Md = buildReport({ kind: 'org' }, new Date(2026, 8, 28), new Date(2026, 9, 4, 23, 59, 59, 999))!.markdown
  ok(w40Md.includes('- nenhuma release na semana'), 'rótulo: nenhuma release no formato da janela (na semana)')
  ok(org7.markdown.includes('- nenhuma release nos 7 dias'), 'rótulo: nenhuma release no formato da janela (nos N dias, rolante)')
  const r30Md = buildReport({ kind: 'org' }, r30.from, r30.to, r30.inProgress, { people: true })!.markdown
  ok(r30Md.includes('- Ana: 50% dos commits fora do horário nos 30 dias (fds/madrugada)'), 'rótulo: fora do horário no formato da janela (nos N dias, rolante)')
  const customFrom = new Date(2026, 9, 8)
  const customTo = new Date(2026, 9, 14, 23, 59, 59, 999)
  const customMd = buildReport({ kind: 'org' }, customFrom, customTo, undefined, { people: true })!.markdown
  ok(customMd.includes(`- **6 commits** (+200% vs 7 dias anteriores (${fmtDay(new Date(2026, 9, 1))}–${fmtDay(new Date(2026, 9, 7, 23, 59, 59, 999))})), 1 dev ativo, 1 repo ativo`), 'delta: "vs N dias anteriores (DD/MM–DD/MM)" para janela custom')
  ok(customMd.includes(`6 commits (+200% vs 7 dias anteriores (${fmtDay(new Date(2026, 9, 1))}–${fmtDay(new Date(2026, 9, 7, 23, 59, 59, 999))})) · 2 PRs mergeados (+0% vs 7 dias anteriores (${fmtDay(new Date(2026, 9, 1))}–${fmtDay(new Date(2026, 9, 7, 23, 59, 59, 999))})) · cycle time 3,0d · 0 releases`), 'abertura: janela custom (no período)')
  ok(customMd.includes('- nenhuma release no período'), 'rótulo: nenhuma release no formato da janela (no período, custom)')
  ok(customMd.includes('- Ana: 67% dos commits fora do horário no período (fds/madrugada)'), 'rótulo: fora do horário no formato da janela (no período, custom)')
  ok(customMd.includes('- Ana: 6 commits (+5) · 0 PRs mergeados · 1 review'), 'linhas por dev: delta absoluto +N, PRs/reviews absolutos')
  ok(customMd.includes('- Beto: 0 commits (−1) · 2 PRs mergeados · 0 reviews'), 'união: dev que sumiu aparece com 0 commits e delta negativo (sinal − unicode)')

  // ── delta: presets em curso omitem comparativo ──
  const weekMd = buildReport({ kind: 'org' }, tw.from, tw.to)!.markdown
  ok(weekMd.includes('_janela em curso — sem comparativo_'), 'em curso: nota no cabeçalho')
  ok(!weekMd.includes('% vs '), 'em curso: nenhum delta no markdown')
  ok(weekMd.includes('- **2 commits**, 1 dev ativo, 1 repo ativo'), 'em curso: commits da parcial')
  ok(weekMd.includes('- Ana: 2 commits (—) · 0 PRs mergeados · 0 reviews'), 'em curso: linha por dev com traço longo no lugar do delta')
  ok(weekMd.includes('2 commits · 0 PRs mergeados · cycle time <1h · 0 releases'), 'abertura: em curso sem deltas')
  ok(weekMd.includes('- sem time: 0 commits · 0 PRs mergeados') && weekMd.includes('times podem sobrepor'), 'times: bloco presente também em janela em curso')

  // ── delta: base 0 ──
  const zeroMd = buildReport({ kind: 'dev', dev: 'Beto' }, lm.from, lm.to)!.markdown
  ok(zeroMd.includes('- **0 commits**, 0 devs ativos, 0 repos ativos'), 'base 0: zeros explícitos')
  ok(!zeroMd.includes('% vs '), 'base 0: sem delta (sem base limpa)')

  // ── degradação: janela maior que a cobertura do github.json (400d) ──
  const longMd = buildReport({ kind: 'org' }, new Date(2025, 5, 1), new Date(2026, 8, 30, 23, 59, 59, 999))!.markdown
  ok(longMd.includes('## Pull requests') && longMd.includes('- sem dados de PRs nesta janela'), 'janela > 400d: seção de PRs degrada com aviso')
  ok(!longMd.includes('mergeados'), 'janela > 400d: sem contagem de PRs (subcontagem)')
  ok(longMd.includes('- Ana: 9 commits (+8)'), 'janela degradada: linhas por dev sem as parcelas de PR/review')
  ok(longMd.includes('- Plataforma: 9 commits') && longMd.includes('- sem time: 0 commits') && !longMd.includes('PRs mergeados'), 'degradação: linhas de time só com commits (nota única já cobre a ausência de PRs)')
  ok(/vs \d+ dias anteriores \(\d{2}\/\d{2}–\d{2}\/\d{2}\)/.test(longMd), 'janela longa: delta com rótulo de N dias anteriores')

  // ── degradação por POSIÇÃO: janela curta inteiramente fora da cobertura ──
  const oldMd = buildReport({ kind: 'org' }, new Date(2023, 0, 1), new Date(2023, 2, 31, 23, 59, 59, 999))!.markdown
  ok(oldMd.includes('## Pull requests') && oldMd.includes('- sem dados de PRs nesta janela'), 'posição: janela fora da cobertura [hoje−400d, hoje] degrada mesmo sendo curta')
  ok(oldMd.split('- sem dados de PRs nesta janela').length === 2, 'posição: UMA nota única, nunca repetida')
  ok(!oldMd.includes('mergeado') && !oldMd.includes('reviews') && !oldMd.includes('cycle time'), 'posição: nenhum número de PR — nada de "0 mergeados" silencioso')
  ok(oldMd.includes('0 commits · 0 releases'), 'posição: abertura sem as parcelas de PR/cycle quando degradado')
  ok(oldMd.includes('- Plataforma: 0 commits') && oldMd.includes('- sem time: 0 commits'), 'posição: linhas de time só com commits, zeros explícitos')

  // ── fallback sem daily.json (coleta anterior à issue #175) ──
  daily.value = null
  const fbMd = buildReport({ kind: 'org' }, lw.from, lw.to, undefined, { people: true })!.markdown
  ok(fbMd.includes('- **6 commits** (+100% vs semana anterior), 2 devs ativos, 2 repos ativos'), 'fallback: semana fechada soma identica ao corte dia-preciso (stats.weekly)')
  ok(fbMd.includes('- sem daily.json — recolete para precisão diária'), 'fallback: rodapé de recoleção')
  ok(!fbMd.includes('- diff:'), 'fallback: sem linha de +/− (só existe com daily)')
  ok(fbMd.includes('- Ana: 80% dos commits fora do horário na semana (fds/madrugada)'), 'fallback: off-hours com weekend/night do weekly')
  ok(fbMd.includes('- Ana: 5 commits (+2) · 1 PR mergeado · 1 review'), 'fallback: linha por dev do stats.weekly')
  ok(fbMd.includes('6 commits (+100% vs semana anterior) · 3 PRs mergeados (+200% vs semana anterior) · cycle time 5,0d · 1 release'), 'fallback: abertura igual ao corte dia-preciso')
  const fbCustomMd = buildReport({ kind: 'org' }, customFrom, customTo)!.markdown
  ok(fbCustomMd.includes('- **8 commits**'), 'fallback: janela custom soma as semanas que INTERSECTAM a janela (W41+W42)')
  daily.value = DAILY

  // ── wrapper do resumo semanal (preset semana fechada × organização) ──
  const weekly = buildWeeklySummary()
  ok(weekly !== null && weekly.weekKey === '2026-W41', 'wrapper: weekKey da semana fechada')
  ok(weekly!.markdown === buildReport({ kind: 'org' }, lw.from, lw.to, undefined, { people: true })!.markdown, 'wrapper: markdown identico ao buildReport(org, semana fechada) com o MESMO opts (people: true)')
  ok(weekly!.markdown.includes('- devs sem commit há 21+ dias: Beto') && weekly!.markdown.includes('- métricas de pessoas — não incluir em relatórios para fora do time'), 'wrapper: resumo semanal mantém a seção de pessoas (people: true explícito)')

  // ── pureza: report.ts nunca importa o estado reativo de filters ──
  const reportSource = readFileSync(new URL('../src/report.ts', import.meta.url), 'utf8')
  ok(!reportSource.includes('from \'./filters'), 'pureza: report.ts sem import de filters/filters-core')
}
catch (err) {
  console.error(`✗ check-report: ${err instanceof Error ? err.message : err}`)
  process.exit(1)
}

// ── renderer ──
try {
  const { renderMarkdown } = await import('../src/markdown')
  const evil = renderMarkdown('## Time <script>alert(1)</script>\n- **<script>bad</script>**: 5 commits')
  ok(evil.includes('&lt;script&gt;alert(1)&lt;/script&gt;') && !evil.includes('<script'), 'renderer: nome com <script> renderiza como texto (escape-first)')
  ok(!/<h[12]>/.test(renderMarkdown('meio da linha # não vira heading nem repo#42')), 'renderer: heading só em início de linha')
  const snake = renderMarkdown('repo_snake_case e repo#42_x ficam intactos')
  ok(snake.includes('repo_snake_case') && snake.includes('repo#42_x') && !snake.includes('<em>'), 'renderer: sublinhado intra-palavra preservado')
  ok(renderMarkdown('- **5 commits** aqui').includes('<strong>5 commits</strong>'), 'renderer: **bold** renderizado')
  ok(renderMarkdown('_dados de ontem_').includes('<em>dados de ontem</em>'), 'renderer: _itálico_ renderizado')
}
catch (err) {
  console.error(`✗ check-report: ${err instanceof Error ? err.message : err}`)
  process.exit(1)
}

console.log(`✓ check-report: ${checks} asserções — buildReport (3 assuntos × janelas), linhas por dev, abertura, rótulos por formato, degradação de PRs, preset→janela, delta, fallback sem daily, opt-in de pessoas (default OFF × people), wrapper, pureza e renderer`)
