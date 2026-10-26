import type { DailyRow, GitHubData, PrReview, PullRequest, ReleasesData, Stats, TeamData } from '../../src/types'
import process from 'node:process'
import { daily } from '../../src/daily'
import { stats } from '../../src/data'
import { setFormatLocale } from '../../src/format'
import { github } from '../../src/github'
import { releases } from '../../src/releases'
import { team } from '../../src/team'

export const REPORT_GOLDEN_BASE = '6009b4f0ab319d4a2d691e8d505bb84415abbc3c'
export const REPORT_GOLDEN_TIMEZONE = 'America/Sao_Paulo'
export const REPORT_GOLDEN_LOCALE = 'pt-BR'

// O probe e o teste compartilham o fuso antes de construir qualquer data local.
process.env.TZ = REPORT_GOLDEN_TIMEZONE
export const REPORT_GOLDEN_NOW = new Date(2026, 9, 15, 12, 0, 0, 0)

export const REPORT_GOLDEN_DAILY: DailyRow[] = [
  { day: '2026-10-05', repo: 'demo-api', author: 'Ana', commits: 1, additions: 10, deletions: 2, weekend: 0, night: 0 },
  { day: '2026-10-06', repo: 'demo-web', author: 'Beto', commits: 1, additions: 3, deletions: 1, weekend: 0, night: 0, scope: 'integration' },
  { day: '2026-10-08', repo: 'demo-api', author: 'Ana', commits: 2, additions: 5, deletions: 1, weekend: 0, night: 2 },
  { day: '2026-10-09', repo: 'demo-api', author: 'CI Bot', commits: 9, additions: 90, deletions: 9, weekend: 0, night: 0 },
  { day: '2026-10-10', repo: 'demo-api', author: 'Ana', commits: 2, additions: 2, deletions: 0, weekend: 2, night: 0 },
  { day: '2026-10-13', repo: 'demo-api', author: 'Ana', commits: 2, additions: 4, deletions: 1, weekend: 0, night: 0 },
  { day: '2026-09-29', repo: 'demo-api', author: 'Ana', commits: 3, additions: 6, deletions: 2, weekend: 0, night: 3 },
  { day: '2026-09-21', repo: 'demo-api', author: 'Ana', commits: 4, additions: 8, deletions: 3, weekend: 0, night: 0 },
  { day: '2026-08-10', repo: 'demo-api', author: 'Ana', commits: 2, additions: 4, deletions: 1, weekend: 0, night: 0 },
  { day: '2025-01-15', repo: 'demo-api', author: 'Ana', commits: 1, additions: 2, deletions: 1, weekend: 0, night: 0 },
]

export const REPORT_GOLDEN_STATS: Stats = {
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

export const REPORT_GOLDEN_GITHUB: GitHubData = {
  generatedAt: '2026-10-15T12:00:00.000Z',
  users: {
    'ana-login': { name: 'Ana', bot: false },
    'beto-login': { name: 'Beto', bot: false },
    'ci-bot': { name: 'CI Bot', bot: true },
  },
  prs: PRS,
}

export const REPORT_GOLDEN_RELEASES: ReleasesData = {
  generatedAt: '2026-10-15T12:00:00.000Z',
  repos: [
    { repo: 'demo-api', url: null, unreleased: 5, tags: [{ tag: 'v1.0.0', date: '2026-10-06T12:00:00.000Z', commits: 3, name: null, notes: null, prerelease: false, url: null }] },
    { repo: 'demo-web', url: null, unreleased: 0, tags: [] },
  ],
}

export const REPORT_GOLDEN_TEAM: TeamData = {
  generatedAt: '2026-10-15T12:00:00.000Z',
  devs: [
    { name: 'Ana', title: null, description: null, emails: [], githubLogins: ['ana-login'], teams: ['Plataforma'], bot: false },
    { name: 'Beto', title: null, description: null, emails: [], githubLogins: ['beto-login'], teams: [], bot: false },
    { name: 'CI Bot', title: null, description: null, emails: [], githubLogins: ['ci-bot'], teams: [], bot: true },
  ],
  teams: [
    { name: 'Plataforma', description: null, color: null, members: ['Ana'] },
    { name: 'Suporte', description: null, color: null, members: [] },
  ],
  candidates: [],
}

export function pinReportGoldenDate(): void {
  const ms = REPORT_GOLDEN_NOW.getTime()
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

export function seedReportGoldenFixture(): void {
  setFormatLocale(REPORT_GOLDEN_LOCALE)
  stats.value = REPORT_GOLDEN_STATS
  github.value = REPORT_GOLDEN_GITHUB
  releases.value = REPORT_GOLDEN_RELEASES
  team.value = REPORT_GOLDEN_TEAM
  daily.value = REPORT_GOLDEN_DAILY
}
