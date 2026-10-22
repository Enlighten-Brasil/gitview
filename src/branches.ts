import type { BranchesData, BranchRow, BranchStatus, PullRequest } from './types'
/**
 * branches.json (issue #123) no frontend — loader + join branch↔PR com o
 * github.json já carregado globalmente pelo shell (_parent.vue). Os status
 * derivados ('viva-sem-PR', 'pousada-via-squash') nascem AQUI, não no coletor:
 * dependem do vínculo headRef/headRefOid dos PRs (issue #122) e degradam para
 * "sem vínculo" quando o cache é antigo (PRs sem headRef), nunca para "sem PR".
 */
import { computed } from 'vue'
import { stats } from './data'
import { filters, repoSelected } from './filters-core'
import { daysSince } from './format'
import { github } from './github'
import { defineLoader } from './loader'
import { team } from './team'

// loader do branches.json — mesmo padrão do github.ts (defineLoader com
// mensagem fixa). Só a coleta FULL o atualiza (a light preserva o inventário),
// por isso a página mostra frescor próprio com o generatedAt daqui.
const branchesLoader = defineLoader<BranchesData>('branches.json', {
  errorMessage: 'sem inventário de branches — rode a coleta completa ("pnpm collect:branches")',
})
export const branches = branchesLoader.data
export const branchesError = branchesLoader.error
export const loadBranches = branchesLoader.load

/**
 * Espelho frontend do default do coletor (GITVIEW_BRANCH_STALE_DAYS,
 * scripts/lib/config.ts). O status 'pousada' já vem pronto no branches.json
 * com o valor configurado; a constante vale só para os derivados do join
 * (pousada-via-squash / abandonada), que o coletor não conhece.
 */
export const BRANCH_STALE_DAYS = 30

// ---------------------------------------------------------------------------
// e-mail → dev (o branches.json carrega o %ae cru do git — fato puramente git;
// o mapeamento vem do team.json#devs[].emails e o fallback exibe o e-mail)
// ---------------------------------------------------------------------------
const devByEmail = computed(() => {
  const m = new Map<string, string>()
  for (const d of team.value?.devs ?? []) {
    for (const e of d.emails)
      m.set(e.toLowerCase(), d.name)
  }
  return m
})

function devOfEmail(email: string): string | null {
  return devByEmail.value.get(email.toLowerCase()) ?? null
}

// ---------------------------------------------------------------------------
// join branch↔PR — índice repo+headRef; PRs de cache antigo (sem headRef)
// ficam fora do índice e a ausência degrada para "sem vínculo" (types.ts)
// ---------------------------------------------------------------------------
const prsByHead = computed(() => {
  const m = new Map<string, PullRequest[]>()
  for (const pr of github.value?.prs ?? []) {
    if (!pr.headRef)
      continue
    const key = `${pr.repo}\u0000${pr.headRef}`
    const list = m.get(key)
    if (list)
      list.push(pr)
    else
      m.set(key, [pr])
  }
  return m
})

function prsOf(repo: string, branch: string): PullRequest[] {
  return prsByHead.value.get(`${repo}\u0000${branch}`) ?? []
}

/** vínculo exibido na tabela: PR aberto mais recente; senão o mergeado mais recente */
export function linkedPr(repo: string, branch: string): PullRequest | null {
  const list = prsOf(repo, branch)
  const open = list
    .filter(pr => pr.state === 'OPEN')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  if (open)
    return open
  return list
    .filter(pr => pr.state === 'MERGED' && pr.mergedAt !== null)
    .sort((a, b) => String(b.mergedAt).localeCompare(String(a.mergedAt)))[0] ?? null
}

export function hasOpenPr(repo: string, branch: string): boolean {
  return prsOf(repo, branch).some(pr => pr.state === 'OPEN')
}

/** compara SHAs tolerando comprimento (o gate aceita tip 7-40 hex) — prefixo case-insensitive */
function sameOid(a: string | null | undefined, b: string): boolean {
  if (!a)
    return false
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  const n = Math.min(x.length, y.length)
  return n >= 7 && x.slice(0, n) === y.slice(0, n)
}

/**
 * Squash-merge reescreve a história: a branch fica aheadProd > 0 para sempre —
 * o trabalho JÁ foi liberado e isso só é detectável pelo join com PR MERGED
 * (repo+headRef iguais E headRefOid == tip OU merge posterior à última
 * atividade; o teste do headRefOid evita falso positivo quando a branch é
 * reutilizada com commits novos após o merge).
 */
export function isSquashPousada(repo: string, br: BranchRow): boolean {
  if (br.aheadProd <= 0)
    return false
  return prsOf(repo, br.name).some(pr =>
    pr.state === 'MERGED' && pr.mergedAt !== null
    && (sameOid(pr.headRefOid, br.tip)
      || new Date(pr.mergedAt).getTime() >= new Date(br.lastActivity).getTime()),
  )
}

/** cobertura do join: fração dos PRs com headRef (cache antigo → badge parcial) */
export const prLinkCoverage = computed(() => {
  const prs = github.value?.prs
  if (!prs || !prs.length)
    return null
  const withHead = prs.filter(pr => pr.headRef != null).length
  return { withHead, total: prs.length, pct: Math.round((withHead / prs.length) * 100) }
})

// ---------------------------------------------------------------------------
// linhas da tabela — inventário flat + join + derivados; respeita os filtros
// de repos/devs/bots da sidebar (o período NÃO se aplica: inventário é "agora")
// ---------------------------------------------------------------------------
export interface BranchRowView {
  repo: string
  name: string
  status: BranchStatus
  /** derivado: ahead > 0 mas liberado via squash-merge (join com PR MERGED) */
  squashPousada: boolean
  /** derivado: feature com ahead > 0 e sem PR aberto — trabalho vivo sem PR (refs de integração com desvio: card develop×produção) */
  vivaSemPr: boolean
  /** derivado: vivaSemPr envelhecida (≥ BRANCH_STALE_DAYS) — mesmo predicado do card Abandonadas */
  abandonada: boolean
  aheadProd: number
  behindProd: number
  aheadInt: number | null
  behindInt: number | null
  lastActivity: string
  ageDays: number
  /** e-mails crus (%ae) dos autores à frente de produção */
  authorsAhead: string[]
  /** devs resolvidos via team.json (e-mail desconhecido mantém o e-mail cru) */
  authorNames: string[]
  /** preview da célula de autores — 2 primeiros; o resto vira "+N" */
  authorNamesTop: string[]
  additions: number
  deletions: number
  /** PR vinculado (aberto tem precedência; null = sem vínculo, nunca "sem PR") */
  pr: PullRequest | null
  githubUrl: string | null
}

/** URL da branch no GitHub (repoUrls do stats.json; null quando não mapeado) */
export function branchGithubUrl(repo: string, name: string): string | null {
  const base = stats.value?.repoUrls?.[repo]
  return base ? `${base}/tree/${name}` : null
}

export const branchRows = computed<BranchRowView[]>(() => {
  // sem github.json o join não existe: derivados ficam desligados e a coluna
  // de PR degrada para "sem vínculo" (nunca afirma "sem PR")
  const ghLoaded = github.value != null
  const out: BranchRowView[] = []
  for (const r of branches.value?.repos ?? []) {
    if (!repoSelected(r.repo))
      continue
    for (const br of r.branches) {
      // branches de bot seguem o switch de bots da sidebar (como as demais vistas)
      if (br.status === 'bot' && !filters.showBots)
        continue
      const squashPousada = ghLoaded && isSquashPousada(r.repo, br)
      const vivaSemPr = ghLoaded && br.status === 'feature' && br.aheadProd > 0
        && !squashPousada && !hasOpenPr(r.repo, br.name)
      const ageDays = daysSince(br.lastActivity)
      const authorNames = br.authorsAhead.map(e => devOfEmail(e) ?? e)
      // filtro de devs: mantém as branches com algum dev selecionado à frente
      if (filters.authors.length && !authorNames.some(n => filters.authors.includes(n)))
        continue
      out.push({
        repo: r.repo,
        name: br.name,
        status: br.status,
        squashPousada,
        vivaSemPr,
        abandonada: vivaSemPr && ageDays >= BRANCH_STALE_DAYS,
        aheadProd: br.aheadProd,
        behindProd: br.behindProd,
        aheadInt: br.aheadInt,
        behindInt: br.behindInt,
        lastActivity: br.lastActivity,
        ageDays,
        authorsAhead: br.authorsAhead,
        authorNames,
        authorNamesTop: authorNames.slice(0, 2),
        additions: br.additions,
        deletions: br.deletions,
        pr: ghLoaded ? linkedPr(r.repo, br.name) : null,
        githubUrl: branchGithubUrl(r.repo, br.name),
      })
    }
  }
  return out
})

/** card (a): podem ser limpas — 'pousada' do coletor (ahead 0 nos dois eixos + velha) ou liberada via squash */
export const pousadas = computed(() =>
  branchRows.value.filter(x =>
    x.status === 'pousada' || (x.squashPousada && x.ageDays >= BRANCH_STALE_DAYS),
  ),
)

/** card (b): trabalho não liberado parado — viva-sem-PR envelhecida (disjunto de (a)); a tabela usa o mesmo predicado (linha.abandonada) */
export const abandonadas = computed(() =>
  branchRows.value.filter(x => x.abandonada),
)

/** preview dos cards (a) e (b): primeiras 5 — "ver todas na tabela" lista o conjunto inteiro */
export const pousadasTop = computed(() => pousadas.value.slice(0, 5))
export const abandonadasTop = computed(() => abandonadas.value.slice(0, 5))

// ---------------------------------------------------------------------------
// card (c): develop × produção POR REPO — um "K commits" global seria ambíguo
// com vários repos; cada repo mostra os dois desvios da 1ª ref de integração
// ---------------------------------------------------------------------------
export interface IntegrationSkew {
  repo: string
  ref: string
  /** à frente da produção = trabalho não liberado */
  ahead: number
  /** atrás da produção; com ahead 0 e velha = integração abandonada/morta */
  behind: number
  stale: boolean
  githubUrl: string | null
}

export const integrationSkew = computed<IntegrationSkew[]>(() => {
  const out: IntegrationSkew[] = []
  for (const r of branches.value?.repos ?? []) {
    if (!repoSelected(r.repo) || !r.integrationRefs.length)
      continue
    const row = r.branches.find(b => b.name === r.integrationRefs[0])
    if (!row || (row.aheadProd === 0 && row.behindProd === 0))
      continue
    out.push({
      repo: r.repo,
      ref: row.name,
      ahead: row.aheadProd,
      behind: row.behindProd,
      stale: daysSince(row.lastActivity) >= BRANCH_STALE_DAYS,
      githubUrl: branchGithubUrl(r.repo, row.name),
    })
  }
  return out.sort((a, b) => b.ahead - a.ahead || b.behind - a.behind)
})

/** badge de frescor (padrão dataAge do _parent.vue) — a coleta light não atualiza o generatedAt */
export const branchesAge = computed(() => {
  if (!branches.value)
    return null
  const hours = (Date.now() - new Date(branches.value.generatedAt).getTime()) / 3_600_000
  const label = hours < 1
    ? 'agora mesmo'
    : hours < 24
      ? `há ${Math.floor(hours)}h`
      : `há ${Math.floor(hours / 24)}d`
  return { label, stale: hours >= 24, generatedAt: branches.value.generatedAt }
})
