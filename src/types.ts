export interface WeeklyRow { week: string; repo: string; author: string; commits: number }
export interface MonthlyRow { month: string; repo: string; author: string; commits: number }
export interface HeatmapRow { author: string; repo: string; weekday: number; hour: number; commits: number }

export interface Stats {
  generatedAt: string
  repos: string[]
  authors: { name: string; emails: string[]; bot: boolean }[]
  totals: {
    commits: number
    additions: number
    deletions: number
    activeDays: number
    repos: number
    authors: number
  }
  perRepo: { repo: string; commits: number; additions: number; deletions: number; authors: number; lastCommit: string }[]
  perAuthor: { author: string; commits: number; additions: number; deletions: number; repos: number; activeDays: number; lastCommit: string; streak: number; longestStreak: number }[]
  weekly: WeeklyRow[]
  monthly: MonthlyRow[]
  heatmap: HeatmapRow[]
}
