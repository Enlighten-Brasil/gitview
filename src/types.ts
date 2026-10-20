/**
 * Escopos de ref que VIAJAM nos JSONs (issues #118/#119) — encoding omit-prod:
 * campo `scope` ausente na linha = 'prod'; o banco (data/gitview.db) é o único
 * lugar com os três valores explícitos ('prod' | 'integration' | 'branch').
 * Union fechada no padrão PR_REVIEW_STATES: campo presente ⇒ 'integration' ou
 * 'branch' (typo de valor não compila; validação condicional no check-data
 * porque o 1º item de uma lista pode ser prod, sem o campo).
 */
export const PROGRESS_SCOPES = ['integration', 'branch'] as const

export type ProgressScope = typeof PROGRESS_SCOPES[number]

/** valida o `scope` opcional das linhas de agregados/commits.json (ausente = prod) */
export function isProgressScope(value: unknown): value is ProgressScope {
  return typeof value === 'string' && (PROGRESS_SCOPES as readonly string[]).includes(value)
}

export interface WeeklyRow { week: string, repo: string, author: string, scope?: ProgressScope, commits: number, weekend: number, night: number }
export interface MonthlyRow { month: string, repo: string, author: string, scope?: ProgressScope, commits: number, additions: number, deletions: number }
export interface HeatmapRow { author: string, repo: string, month: string, weekday: number, hour: number, scope?: ProgressScope, commits: number }
export interface MonthlyTypeRow { month: string, repo: string, author: string, scope?: ProgressScope, type: string, commits: number }

/**
 * Eixo de escopo do autor dentro de perAuthor (issue #152): os MESMOS campos
 * medidos da linha integral, calculados só sobre as linhas do eixo —
 * prod = scope 'prod'; progress = 'integration' + 'branch'. `lastCommit` é
 * `''` quando o eixo não tem commits (autor só de um escopo tem o outro eixo
 * zerado — as duas chaves sempre existem quando byScope está presente).
 */
export interface PerAuthorScopeAxis {
  commits: number
  additions: number
  deletions: number
  repos: number
  activeDays: number
  lastCommit: string
  streak: number
  longestStreak: number
}

export interface PerAuthorRow extends PerAuthorScopeAxis {
  author: string
  /**
   * Eixos por escopo (issue #152) — AUSENTE em dados coletados antes da
   * feature (feature-detect no frontend: presença de `byScope`; a degradação
   * mantém a linha integral com "(total)"). Quando presente, AMBOS os eixos
   * existem: a filosofia omit-prod vale para o campo `scope` das linhas de
   * agregados, não para as chaves do byScope. Linhas com scope NULL no banco
   * ficam fora dos eixos (mesma convenção/aviso dos totals).
   */
  byScope?: { prod: PerAuthorScopeAxis, progress: PerAuthorScopeAxis }
}

export interface Stats {
  generatedAt: string
  repos: string[]
  /** repo -> URL web do remote (para links de commit); ausente quando não há remote do GitHub */
  repoUrls?: Record<string, string>
  authors: { name: string, emails: string[], bot: boolean }[]
  totals: {
    commits: number
    /** commits alcançáveis da ref de produção (linhas sem `scope`); soma com progressCommits == commits */
    prodCommits: number
    /** commits em progresso: linhas com `scope` 'integration' + 'branch' */
    progressCommits: number
    additions: number
    deletions: number
    activeDays: number
    repos: number
    authors: number
  }
  perRepo: { repo: string, commits: number, prodCommits: number, progressCommits: number, additions: number, deletions: number, authors: number, lastCommit: string }[]
  perAuthor: PerAuthorRow[]
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
  /** escopo de ref (omit-prod: ausente = 'prod') — mesma codificação das linhas de agregados */
  scope?: ProgressScope
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
  /**
   * Vínculo PR↔branch: nomes das branches head/base e SHA do head no momento
   * da coleta. Opcionais porque o merge incremental preserva PRs de caches
   * anteriores aos campos até um clean+full (`pnpm clean && pnpm collect`).
   * `headRef` sobrevive ao auto-delete da branch em PRs mergeados. UI trata
   * ausência como "sem vínculo" (cobertura parcial), nunca como "sem PR".
   */
  headRef?: string | null
  baseRef?: string | null
  headRefOid?: string | null
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

// ---------------------------------------------------------------------------
// branches.json — inventário de branches por repo (issue #123)
// ---------------------------------------------------------------------------
/**
 * Status de branch (union fechada no padrão PR_REVIEW_STATES):
 * - `production`: a ref de produção do repo (nome == productionRef)
 * - `integration`: ref de integração (nome ∈ integrationRefs)
 * - `bot`: nome casa BOT_BRANCH_RE (dependabot/*, renovate/*) ou GITVIEW_BOT_BRANCHES
 * - `pousada`: aheadProd == 0 e sem atividade há ≥ GITVIEW_BRANCH_STALE_DAYS dias
 * - `feature`: demais
 * Vínculos com PR ('viva-sem-PR', 'pousada-via-squash') NÃO fazem parte da
 * union: o frontend os calcula em join com github.json (headRef).
 */
export const BRANCH_STATUSES = ['production', 'integration', 'feature', 'bot', 'pousada'] as const

export type BranchStatus = typeof BRANCH_STATUSES[number]

/** valida o `status` de uma linha do branches.json (usado no check-data) */
export function isBranchStatus(value: unknown): value is BranchStatus {
  return typeof value === 'string' && (BRANCH_STATUSES as readonly string[]).includes(value)
}

export interface BranchRow {
  name: string
  /** SHA do commit da ponta (o gate aceita 7-40 hex; o coletor grava o full de for-each-ref) */
  tip: string
  /** última atividade (committerdate do tip) em UTC ISO com milis */
  lastActivity: string
  /** commits SEM merges à frente da ref de produção (decisão #7) */
  aheadProd: number
  /** commits SEM merges da produção ausentes da branch */
  behindProd: number
  /** vs a PRIMEIRA ref de integração resolvida; null quando o repo não tem nenhuma */
  aheadInt: number | null
  behindInt: number | null
  /**
   * E-mails crus (%ae) distintos dos autores à frente de produção — desvio
   * consciente do padrão canônico do stats.json: branches.json é fato
   * puramente git (edição de alias/time reflete sem recoletar); o frontend
   * mapeia e-mail→dev via team.json#devs[].emails.
   */
  authorsAhead: string[]
  additions: number
  deletions: number
  status: BranchStatus
}

export interface RepoBranches {
  repo: string
  /** ref de produção resolvida pelo seam (scripts/lib/refs.ts) */
  productionRef: string
  /** refs de integração que EXISTEM no repo (pode ser vazio) */
  integrationRefs: string[]
  branches: BranchRow[]
}

export interface BranchesData {
  generatedAt: string
  repos: RepoBranches[]
}

// ---------------------------------------------------------------------------
// graph-REPO.json — janela de commits p/ o grafo de lanes (issue #127;
// coletor da issue #126). Lanes NÃO viajam no JSON: o coletor emite só
// topologia + metadados e o frontend calcula (src/graph/lanes.ts, ~7 ms p/
// N=1000) — permite iterar geometria/cores sem recoletar.
// ---------------------------------------------------------------------------
export interface GraphCommit {
  /** sha completo (40 hex) — as URLs de commit do GitHub usam ele */
  hash: string
  /** shas completos dos pais na ordem do git (1º = primeira mãe); vazio = root */
  parents: string[]
  /** autor canônico (mapeado via team.json na coleta; fallback = nome cru do git) */
  author: string
  /** data do autor em UTC ISO com milissegundos */
  date: string
  /** assunto cru (%s) — a truncagem é da UI */
  subject: string
  /**
   * refs que apontam para o commit: `%d` cru do git ("(HEAD -> main,
   * tag: v1.0)") OU array já parseado (strings/objetos { name, type }) — o
   * reader (src/graph/refs.ts) tipa os dois; ausente/vazio = nenhuma.
   */
  refs?: string | string[] | { name: string, type?: string }[]
}

export interface GraphData {
  generatedAt: string
  repo: string
  /** tamanho da janela coletada (`git log --all --date-order -n <window>`) */
  window: number
  /** ordem de exibição = saída do `git log --all --date-order` preservada (descendente) */
  commits: GraphCommit[]
}
