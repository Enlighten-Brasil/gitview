import type { DailyRow, GitHubData, PullRequest, ReleasesData, Stats, TeamData } from '../src/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daily } from '../src/daily'
import { stats } from '../src/data'
import { fmtDate, fmtDay } from '../src/format'
import { github } from '../src/github'
import { releases } from '../src/releases'
import { buildReport, customWindow, presetWindow, rollingWindow } from '../src/report'
import { team } from '../src/team'

/**
 * Issue #249 — janela de relatório + buildReport. Casos derivados da TABELA
 * do gate `check:report` (que continua intacta e é a referência completa):
 * aqui ficam os comportamentos críticos — preset→janela com `now` injetado,
 * linha de abertura/por dev, delta por formato, degradação por posição,
 * fallback sem daily e opt-in de pessoas. Relógio pinado nos testes de
 * buildReport: `new Date()` é global no módulo (só as janelas aceitam `now`).
 * Fixture sintética inline, nomes genéricos (check:scrub).
 */
const NOW = new Date(2026, 9, 15, 12, 0, 0, 0) // quinta — semana W41 = 05/10–11/10/2026

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

const PRS: PullRequest[] = [
  { repo: 'demo-api', number: 1, title: 'feat: a', url: 'u1', state: 'MERGED', draft: false, author: 'ana-login', createdAt: '2026-10-01T12:00:00.000Z', mergedAt: '2026-10-06T12:00:00.000Z', additions: 10, deletions: 2, changedFiles: 1, reviews: [{ author: 'beto-login', state: 'APPROVED', submittedAt: '2026-10-05T12:00:00.000Z' }] },
  { repo: 'demo-web', number: 2, title: 'feat: b', url: 'u2', state: 'MERGED', draft: false, author: 'beto-login', createdAt: '2026-10-08T12:00:00.000Z', mergedAt: '2026-10-09T12:00:00.000Z', additions: 3, deletions: 1, changedFiles: 1, reviews: [] },
  { repo: 'demo-api', number: 3, title: 'chore: bot', url: 'u3', state: 'MERGED', draft: false, author: 'ci-bot', createdAt: '2026-10-06T12:00:00.000Z', mergedAt: '2026-10-07T12:00:00.000Z', additions: 1, deletions: 0, changedFiles: 1, reviews: [] },
  { repo: 'demo-web', number: 4, title: 'fix: c', url: 'u4', state: 'MERGED', draft: false, author: 'beto-login', createdAt: '2026-09-30T12:00:00.000Z', mergedAt: '2026-10-02T12:00:00.000Z', additions: 5, deletions: 5, changedFiles: 2, reviews: [{ author: 'ana-login', state: 'APPROVED', submittedAt: '2026-10-01T12:00:00.000Z' }] },
  { repo: 'demo-api', number: 5, title: 'feat: parado', url: 'u5', state: 'OPEN', draft: false, author: 'ana-login', createdAt: '2026-09-20T12:00:00.000Z', mergedAt: null, additions: 7, deletions: 1, changedFiles: 1, reviews: [] },
  { repo: 'demo-api', number: 6, title: 'chore: bot aberto', url: 'u6', state: 'OPEN', draft: false, author: 'ci-bot', createdAt: '2026-09-18T12:00:00.000Z', mergedAt: null, additions: 1, deletions: 1, changedFiles: 1, reviews: [] },
  { repo: 'demo-web', number: 7, title: 'feat: d', url: 'u7', state: 'MERGED', draft: false, author: 'beto-login', createdAt: '2026-10-05T12:00:00.000Z', mergedAt: '2026-10-10T12:00:00.000Z', additions: 9, deletions: 3, changedFiles: 1, reviews: [{ author: 'ana-login', state: 'COMMENTED', submittedAt: '2026-10-06T12:00:00.000Z' }] },
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

beforeEach(() => {
  vi.useFakeTimers({ now: NOW })
  stats.value = STATS
  github.value = GITHUB
  releases.value = RELEASES_DATA
  team.value = TEAM_DATA
  daily.value = DAILY
})

afterEach(() => {
  vi.useRealTimers()
  stats.value = null
  github.value = null
  releases.value = null
  team.value = null
  daily.value = null
})

describe('presetWindow / rollingWindow / customWindow (now injetado)', () => {
  it('presets de semana e mês: fechados ou em curso', () => {
    const lw = presetWindow('last-week', NOW)
    expect(lw.from).toEqual(new Date(2026, 9, 5))
    expect(lw.to).toEqual(new Date(2026, 9, 11, 23, 59, 59, 999))
    expect(lw.inProgress).toBe(false)

    const lm = presetWindow('last-month', NOW)
    expect(lm.from).toEqual(new Date(2026, 8, 1))
    expect(lm.to).toEqual(new Date(2026, 8, 30, 23, 59, 59, 999))
    expect(lm.inProgress).toBe(false)

    const tw = presetWindow('this-week', NOW)
    expect(tw.from).toEqual(new Date(2026, 9, 12))
    expect(tw.to).toEqual(NOW)
    expect(tw.inProgress).toBe(true)

    const tm = presetWindow('this-month', NOW)
    expect(tm.from).toEqual(new Date(2026, 9, 1))
    expect(tm.to).toEqual(NOW)
    expect(tm.inProgress).toBe(true)
  })

  it('rolantes são completas (delta habilitado) e a personalizada marca em curso só se termina hoje', () => {
    const r7 = rollingWindow(7, NOW)
    expect(r7.from).toEqual(new Date(2026, 9, 9))
    expect(r7.to).toEqual(NOW)
    expect(r7.inProgress).toBe(false)
    expect(rollingWindow(30, NOW).from).toEqual(new Date(2026, 8, 16))

    const closed = customWindow('2026-10-01', '2026-10-14', NOW)
    expect(closed.to).toEqual(new Date(2026, 9, 14, 23, 59, 59, 999))
    expect(closed.inProgress).toBe(false)
    expect(customWindow('2026-10-01', '2026-10-15', NOW).inProgress).toBe(true)
    // termina depois de hoje também é em curso (fim futuro ≠ janela fechada)
    expect(customWindow('2026-10-16', '2026-10-20', NOW).inProgress).toBe(true)
  })
})

describe('buildReport — assunto org × semana fechada (caminho do resumo)', () => {
  it('abertura, linhas por dev, diff, PRs, releases e times', () => {
    const lw = presetWindow('last-week', NOW)
    const org = buildReport({ kind: 'org' }, lw.from, lw.to, undefined, { people: true })
    expect(org).not.toBeNull()
    const md = org!.markdown

    expect(org!.title).toBe(`Resumo da semana — ${fmtDay(lw.from)} a ${fmtDate(lw.to)} (2026-W41)`)
    expect(md).toContain('6 commits (+100% vs semana anterior) · 3 PRs mergeados (+200% vs semana anterior) · cycle time 5,0d · 1 release')
    expect(md).toContain('- **6 commits** (+100% vs semana anterior), 2 devs ativos, 2 repos ativos')
    expect(md).toContain('- Ana: 5 commits (+2) · 1 PR mergeado · 1 review')
    expect(md).toContain('- Beto: 1 commit (+1) · 2 PRs mergeados · 1 review')
    expect(md).not.toContain('top devs')
    expect(md).toContain('- repos mais ativos: demo-api (5), demo-web (1)')
    expect(md).toContain('- diff: +20/-4 (prod 5 · progresso 1 commits)')
    expect(md).toContain('- **3 mergeados** (+200% vs semana anterior), cycle time mediano (janela do relatório) 5,0d')
    expect(md).toContain('- 1 aberto agora, **1 parado há 14+ dias**: demo-api#5 (25d)')
    expect(md).toContain('- 33% mergeados sem review (1 PR)')
    expect(md).toContain('- commits não liberados: demo-api (5)')
    expect(md).toContain('- Plataforma: 5 commits · 1 PR mergeado')
    expect(md).toContain('- Suporte: 0 commits · 0 PRs mergeados')
    expect(md).toContain('- sem time: 1 commit · 2 PRs mergeados')
    expect(md).not.toContain('CI Bot') // bots fora de commits e PRs
  })

  it('opt-in de pessoas: default OFF × people: true', () => {
    const lw = presetWindow('last-week', NOW)
    const off = buildReport({ kind: 'org' }, lw.from, lw.to)!.markdown
    expect(off).not.toContain('fora do horário')
    expect(off).not.toContain('devs sem commit')
    expect(off).toContain('- repos sem commit há 30+ dias: demo-web') // higiene de repo fica no default
    expect(off).not.toContain('métricas de pessoas')

    const on = buildReport({ kind: 'org' }, lw.from, lw.to, undefined, { people: true })!.markdown
    expect(on).toContain('- Ana: 80% dos commits fora do horário na semana (fds/madrugada)')
    expect(on).toContain('- devs sem commit há 21+ dias: Beto')
    expect(on).toContain('- (até hoje, independe do período)')
    expect(on).toContain('- métricas de pessoas — não incluir em relatórios para fora do time')
  })

  it('janela em curso: nota no cabeçalho, nenhum delta e traço no lugar do delta por dev', () => {
    const tw = presetWindow('this-week', NOW)
    const md = buildReport({ kind: 'org' }, tw.from, tw.to)!.markdown
    expect(md).toContain('_janela em curso — sem comparativo_')
    expect(md).not.toContain('% vs ')
    expect(md).toContain('- **2 commits**, 1 dev ativo, 1 repo ativo')
    expect(md).toContain('- Ana: 2 commits (—) · 0 PRs mergeados · 0 reviews')
  })
})

describe('buildReport — degradação por posição da cobertura de PRs', () => {
  it('janela > 400d degrada com UMA nota e sem contagem de PRs', () => {
    const md = buildReport({ kind: 'org' }, new Date(2025, 5, 1), new Date(2026, 8, 30, 23, 59, 59, 999))!.markdown
    expect(md).toContain('## Pull requests')
    expect(md).toContain('- sem dados de PRs nesta janela')
    expect(md.split('- sem dados de PRs nesta janela')).toHaveLength(2)
    expect(md).not.toContain('mergeados')
    expect(md).toContain('- Ana: 9 commits (+8)')
  })

  it('janela curta inteiramente fora da cobertura também degrada', () => {
    const md = buildReport({ kind: 'org' }, new Date(2023, 0, 1), new Date(2023, 2, 31, 23, 59, 59, 999))!.markdown
    expect(md).toContain('- sem dados de PRs nesta janela')
    expect(md).not.toContain('cycle time')
    expect(md).toContain('0 commits · 0 releases')
  })
})

describe('buildReport — fallback e assuntos', () => {
  it('sem daily.json soma stats.weekly e avisa a recoleção', () => {
    daily.value = null
    const lw = presetWindow('last-week', NOW)
    const md = buildReport({ kind: 'org' }, lw.from, lw.to)!.markdown
    expect(md).toContain('- **6 commits** (+100% vs semana anterior), 2 devs ativos, 2 repos ativos')
    expect(md).toContain('- sem daily.json — recolete para precisão diária')
    expect(md).not.toContain('- diff:')
    expect(md).toContain('- Ana: 5 commits (+2) · 1 PR mergeado · 1 review')
  })

  it('assunto dev mantém top devs e omite releases; time recorta aos membros', () => {
    const lw = presetWindow('last-week', NOW)
    const ana = buildReport({ kind: 'dev', dev: 'Ana' }, lw.from, lw.to)!.markdown
    expect(ana).toContain('Resumo da semana · Ana —')
    expect(ana).toContain('- top devs: Ana (5)')
    expect(ana).not.toContain('## Releases')
    expect(ana).not.toContain('repos sem commit')

    const time = buildReport({ kind: 'team', team: 'Plataforma' }, lw.from, lw.to)!.markdown
    expect(time).toContain('- **5 commits** (+67% vs semana anterior), 1 dev ativo, 1 repo ativo')
    expect(time).not.toContain('- sem time:')
    expect(time).toContain('## Releases')
  })

  it('sem stats carregados devolve null (o caller mostra o estado vazio)', () => {
    stats.value = null
    expect(buildReport({ kind: 'org' }, NOW, NOW)).toBeNull()
  })
})
