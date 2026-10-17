export interface WeeklyRow { week: string, repo: string, author: string, commits: number, weekend: number, night: number }
export interface MonthlyRow { month: string, repo: string, author: string, commits: number, additions: number, deletions: number }
export interface HeatmapRow { author: string, repo: string, month: string, weekday: number, hour: number, commits: number }
export interface MonthlyTypeRow { month: string, repo: string, author: string, type: string, commits: number }

export interface Stats {
  generatedAt: string
  repos: string[]
  /** repo -> URL web do remote (para links de commit); ausente quando não há remote do GitHub */
  repoUrls?: Record<string, string>
  authors: { name: string, emails: string[], bot: boolean }[]
  totals: {
    commits: number
    additions: number
    deletions: number
    activeDays: number
    repos: number
    authors: number
  }
  perRepo: { repo: string, commits: number, additions: number, deletions: number, authors: number, lastCommit: string }[]
  perAuthor: { author: string, commits: number, additions: number, deletions: number, repos: number, activeDays: number, lastCommit: string, streak: number, longestStreak: number }[]
  weekly: WeeklyRow[]
  monthly: MonthlyRow[]
  heatmap: HeatmapRow[]
  monthlyTypes?: MonthlyTypeRow[]
}

export interface CommitRow {
  hash: string
  repo: string
  author: string
  date: string
  message: string
  additions: number
  deletions: number
}

/**
 * estados possíveis de uma review (enum PullRequestReviewState da API GraphQL
 * do GitHub) — union fechada: typo de valor não compila (issue #42)
 */
export const PR_REVIEW_STATES = ['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED', 'PENDING'] as const

export type PrReviewState = typeof PR_REVIEW_STATES[number]

/** valida o `state` de uma review vindo do github.json (usado no check-data) */
export function isPrReviewState(value: unknown): value is PrReviewState {
  return typeof value === 'string' && (PR_REVIEW_STATES as readonly string[]).includes(value)
}

export interface PrReview { author: string, state: PrReviewState, submittedAt: string }

export interface PullRequest {
  repo: string
  number: number
  title: string
  url: string
  state: 'OPEN' | 'MERGED'
  draft: boolean
  author: string
  createdAt: string
  mergedAt: string | null
  additions: number
  deletions: number
  changedFiles: number
  reviews: PrReview[]
}

/** PR com `mergedAt` garantido — resultado do narrowing de `isMergedPr` (issue #42) */
export type MergedPr = PullRequest & { mergedAt: string }

/** narrowing de PR mergeado (state MERGED ⇒ mergedAt preenchido; invariante validada no check-data) */
export function isMergedPr(pr: PullRequest): pr is MergedPr {
  return pr.state === 'MERGED' && pr.mergedAt !== null
}

export interface GitHubData {
  generatedAt: string
  /** login do GitHub -> nome canônico do time + flag de bot */
  users: Record<string, { name: string, bot: boolean }>
  prs: PullRequest[]
}

export interface ReleaseTag {
  tag: string
  date: string
  /** commits desde a tag anterior */
  commits: number
  name: string | null
  /** notas da release no GitHub (truncadas); null quando a tag não virou release */
  notes: string | null
  prerelease: boolean
  url: string | null
}

export interface RepoReleases {
  repo: string
  url: string | null
  /** commits desde a última tag (trabalho ainda não liberado) */
  unreleased: number
  /** mais recente primeiro */
  tags: ReleaseTag[]
}

export interface ReleasesData {
  generatedAt: string
  repos: RepoReleases[]
}

// ---------------------------------------------------------------------------
// team.json — perfis de devs e times (team.local.json + aliases detectados)
// ---------------------------------------------------------------------------
export interface DevProfileInfo {
  /** nome canônico (chave de join com stats/github) */
  name: string
  title: string | null
  description: string | null
  /** e-mails de commit conhecidos (config + detectados no git) */
  emails: string[]
  /** logins do GitHub mapeados pra este dev */
  githubLogins: string[]
  /** times dos quais o dev faz parte */
  teams: string[]
  bot: boolean
}

export interface TeamInfo {
  name: string
  description: string | null
  color: string | null
  members: string[]
  /** nomes antigos do time (renomeado na UI) — /teams/<nome-antigo> redireciona */
  renamedFrom?: string[]
}

/** identidade vista nos dados mas sem perfil/mapeamento — candidata a cadastro */
export interface TeamCandidate {
  kind: 'author' | 'login'
  /** nome do autor (git) ou login (GitHub) */
  id: string
  /** e-mails vistos (author) */
  emails?: string[]
  /** PRs/reviews vistos (login) */
  prs?: number
}

export interface TeamData {
  generatedAt: string
  devs: DevProfileInfo[]
  teams: TeamInfo[]
  candidates: TeamCandidate[]
}
