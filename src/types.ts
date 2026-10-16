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

export interface PrReview { author: string, state: string, submittedAt: string }

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
