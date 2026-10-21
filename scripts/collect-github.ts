/**
 * Coletor de Pull Requests do GitHub (complemento do collect.ts).
 *
 * 1. Descobre repos em `reposRoot` e resolve owner/repo pelo remote origin
 * 2. Busca PRs abertos (todos) e mergeados (últimos 400 dias) na API GraphQL,
 *    já com reviews inline (1 request por página de 100 PRs)
 * 3. Grava tudo em public/data/github.json — o frontend continua 100% estático
 *
 * Auth: token do .env (GITVIEW_GITHUB_TOKEN) com fallback pro `gh auth token`.
 * Logins do GitHub são mapeados para os nomes canônicos via devProfiles (/teams).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { loadConfig, resolveReposRoot } from './lib/config'
import { getToken, ghGraphql, GhHttpError } from './lib/github'
import { initLog } from './lib/log'
import { discoverRepos, mapPool, parseGitHub, remoteOf } from './lib/repos'
import { BOT_LOGIN_RE, botLoginSet, resolveAliases } from './lib/team'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

/** mergeados mais antigos que isso ficam de fora (cobre a visão de 12M com folga) */
const MERGED_CUTOFF_DAYS = 400

initLog('collect-github')
const config = loadConfig()

// ---------------------------------------------------------------------------
// API GraphQL (fetch direto com o token da config) — async pra rodar
// repos em paralelo
// ---------------------------------------------------------------------------
const auth = getToken()
if (!auth)
  console.warn('! sem token do GitHub — PRs novos não serão buscados (cache anterior é preservado). Rode o setup da UI ou "gh auth login".')

function gh<T>(query: string, vars: Record<string, unknown>): Promise<T> {
  if (!auth)
    return Promise.reject(new Error('sem token do GitHub (configure no setup ou via gh auth login)'))
  return ghGraphql<T>(query, vars, auth.token)
}

/** map assíncrono com concorrência limitada (repos em paralelo) — scripts/lib/repos.ts */

/**
 * Retry em erros transitórios (HTTP 5xx, rede e 403/429 de rate limit — com o
 * backoff da própria API via Retry-After/x-ratelimit-reset; follow-up #11) — um
 * 502 no meio da paginação não pode derrubar o repo inteiro (no modo completo
 * ele sairia zerado). Erros de body do GraphQL só voltam quando falam de rate
 * limit; os demais caem no fallback de cache como antes.
 */
async function ghRetry<T>(query: string, vars: Record<string, unknown>): Promise<T> {
  let lastErr: Error | null = null
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await gh<T>(query, vars)
    }
    catch (err) {
      lastErr = err as Error
      const http = err instanceof GhHttpError ? err : null
      const transient = http
        ? http.status >= 500 || http.status === 403 || http.status === 429
        : /HTTP 5\d\d|ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket|fetch failed|rate limit|abuse/i.test(lastErr.message)
      if (!transient || attempt === 3)
        throw err
      const wait = Math.max(http?.retryAfterMs ?? 0, attempt * 2000)
      console.warn(`  ! GitHub ${http ? `HTTP ${http.status}` : 'transitório'} — aguardando ${(wait / 1000).toFixed(0)}s (tentativa ${attempt + 1}/3)`)
      await new Promise(r => setTimeout(r, wait))
    }
  }
  throw lastErr
}

const PR_QUERY = `
query($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: 100, after: $cursor, states: [$states], orderBy: { field: $order, direction: DESC }) {
      nodes {
        number title url state isDraft createdAt updatedAt mergedAt
        additions deletions changedFiles
        headRefName baseRefName headRefOid
        author { login }
        reviews(first: 100) {
          totalCount
          nodes { author { login } state submittedAt }
          pageInfo { hasNextPage endCursor }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
  rateLimit { remaining }
}`

/** continuação de reviews de um PR específico (só usado quando reviews.totalCount estoura a 1ª página) */
const REVIEWS_QUERY = `
query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviews(first: 100, after: $cursor) {
        totalCount
        nodes { author { login } state submittedAt }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`

interface GhPr {
  number: number
  title: string
  url: string
  state: 'OPEN' | 'MERGED'
  isDraft: boolean
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  additions: number
  deletions: number
  changedFiles: number
  /** vínculo PR↔branch — NON_NULL na API; headRefName sobrevive ao auto-delete da branch (issue #122) */
  headRefName: string
  baseRefName: string
  headRefOid: string
  author: { login: string } | null
  reviews: {
    totalCount?: number
    nodes: { author: { login: string } | null, state: string, submittedAt: string }[]
    pageInfo?: { hasNextPage: boolean, endCursor: string | null }
  }
}

interface QueryResult {
  repository: {
    pullRequests: {
      nodes: GhPr[]
      pageInfo: { hasNextPage: boolean, endCursor: string | null }
    }
  } | null
  rateLimit: { remaining: number }
}

async function fetchPrs(
  ghRepo: { owner: string, repo: string },
  states: 'OPEN' | 'MERGED',
  cutoff: Date | null,
): Promise<GhPr[]> {
  const order = states === 'OPEN' ? 'CREATED_AT' : 'UPDATED_AT'
  const query = PR_QUERY.replace('$states', states).replace('$order', order)
  const out: GhPr[] = []
  let cursor: string | null = null

  let hasNext = false
  let page = 0
  for (; page < 30; page++) {
    const vars: Record<string, string> = { owner: ghRepo.owner, name: ghRepo.repo }
    if (cursor)
      vars.cursor = cursor
    const data = await ghRetry<QueryResult>(query, vars)
    const prs = data.repository?.pullRequests
    if (!prs)
      break
    out.push(...prs.nodes)
    hasNext = prs.pageInfo.hasNextPage
    if (!hasNext)
      break
    // mergeados vêm por UPDATED_AT desc: para quando a página já passou do cutoff
    const oldest = prs.nodes[prs.nodes.length - 1]
    if (cutoff && oldest && new Date(oldest.updatedAt) < cutoff)
      break
    cursor = prs.pageInfo.endCursor
  }
  // teto de páginas atingido com mais páginas por vir: avisa (nunca trunca em silêncio)
  if (page === 30 && hasNext)
    console.warn(`  ! ${ghRepo.owner}/${ghRepo.repo}: PRs ${states} truncados em ${out.length} (teto de 30 páginas em fetchPrs)`)
  return out
}

interface ReviewsPage {
  repository: {
    pullRequest: {
      reviews: { nodes: GhPr['reviews']['nodes'], pageInfo: { hasNextPage: boolean, endCursor: string | null } }
    } | null
  } | null
}

/**
 * PR com mais reviews que a página inline (100): continua por cursor com o
 * mesmo CREATED_AT ASC (issue #6). O resto é anexado ao nó da lista.
 */
async function fetchRestReviews(ghRepo: { owner: string, repo: string }, pr: GhPr): Promise<void> {
  const total = pr.reviews.totalCount ?? pr.reviews.nodes.length
  let cursor = pr.reviews.pageInfo?.endCursor ?? null
  for (let page = 0; page < 10 && cursor && pr.reviews.nodes.length < total; page++) {
    const data = await ghRetry<ReviewsPage>(REVIEWS_QUERY, { owner: ghRepo.owner, name: ghRepo.repo, number: pr.number, cursor })
    const rev = data.repository?.pullRequest?.reviews
    if (!rev || !rev.nodes.length)
      break
    pr.reviews.nodes.push(...rev.nodes)
    if (!rev.pageInfo.hasNextPage)
      break
    cursor = rev.pageInfo.endCursor
  }
  // teto de páginas atingido com reviews restantes: avisa (nunca trunca em silêncio)
  if (pr.reviews.nodes.length < total)
    console.warn(`  ! ${ghRepo.repo}#${pr.number}: reviews truncados em ${pr.reviews.nodes.length}/${total} (teto de 10 páginas de continuação)`)
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const FULL = process.argv.includes('--full')

const userMap = resolveAliases(config).loginToCanonical
const botLogins = botLoginSet(config)
function isBotLogin(login: string): boolean {
  return botLogins.has(login.toLowerCase()) || BOT_LOGIN_RE.test(login)
}

/** PR normalizado no formato do github.json (shape solto pra aceitar o arquivo anterior) */
interface PrRow {
  repo: string
  number: number
  state: string
  author: string
  reviews: { author: string }[]
  /** vínculo PR↔branch — opcionais: o merge incremental preserva linhas de caches anteriores a ele sem os campos (até um clean+full) */
  headRef?: string | null
  baseRef?: string | null
  headRefOid?: string | null
  [k: string]: unknown
}

const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, 'github.json')

// incremental: PRs mergeados mudam pouco — refetch só dos atualizados desde a última
// coleta (margem de 1 dia) e merge com o arquivo anterior. `--full` ignora o cache
// para o FETCH, mas o arquivo anterior segue carregado como rede de segurança:
// um repo que falha no modo completo não pode sair zerado do painel.
const cached = existsSync(outFile)
  ? JSON.parse(readFileSync(outFile, 'utf-8')) as { generatedAt: string, prs: PrRow[] }
  : null
const prev = FULL ? null : cached

const cutoff = new Date()
if (prev) {
  cutoff.setTime(new Date(prev.generatedAt).getTime() - 24 * 3600 * 1000)
  console.log(`Modo: incremental (mergeados atualizados desde ${cutoff.toISOString().slice(0, 10)})`)
}
else {
  cutoff.setDate(cutoff.getDate() - MERGED_CUTOFF_DAYS)
  console.log(`Modo: completo (mergeados dos últimos ${MERGED_CUTOFF_DAYS} dias)`)
}

// janela de mergeados: updatedAt dentro da janela não basta — PRs antigos com
// atividade recente (rebase, comentário) entram pelo fetch incremental e
// poluíam os painéis de 12M. Nada com mergedAt mais velho que 400d permanece.
const windowCutoff = new Date()
windowCutoff.setDate(windowCutoff.getDate() - MERGED_CUTOFF_DAYS)

const repos = discoverRepos(resolveReposRoot(config))
const fresh = new Map<string, PrRow>() // repo#number -> PR
let fetchedCount = 0
let skipped = 0

let outOfWindow = 0

await mapPool(repos, 4, async (repo) => {
  const remote = remoteOf(repo.path)
  const ghRepo = remote ? parseGitHub(remote) : null
  if (!ghRepo) {
    console.log(`— ${repo.name}: sem remote do GitHub, pulado`)
    skipped++
    return
  }

  const t0 = Date.now()
  try {
    const [open, merged] = await Promise.all([
      fetchPrs(ghRepo, 'OPEN', null),
      fetchPrs(ghRepo, 'MERGED', cutoff),
    ])

    // PRs com mais reviews que a página inline (100) — continua por cursor;
    // se a continuação falhar, mantém o que veio e avisa (nunca silencia)
    for (const pr of [...open, ...merged]) {
      if ((pr.reviews.totalCount ?? pr.reviews.nodes.length) > pr.reviews.nodes.length) {
        try {
          await fetchRestReviews(ghRepo, pr)
        }
        catch (err) {
          console.warn(`  ! ${repo.name}#${pr.number}: reviews incompletos (${pr.reviews.nodes.length}/${pr.reviews.totalCount}) — ${(err as Error).message}`)
        }
      }
    }

    for (const pr of [...open, ...merged]) {
      // PR antigo com atividade recente entra pelo incremental (updatedAt) —
      // descarta aqui os que caem fora da janela de mergedAt
      if (pr.state === 'MERGED' && pr.mergedAt && new Date(pr.mergedAt) < windowCutoff) {
        outOfWindow++
        continue
      }
      fresh.set(`${repo.name}#${pr.number}`, {
        repo: repo.name,
        number: pr.number,
        title: pr.title,
        url: pr.url,
        state: pr.state,
        draft: pr.isDraft,
        author: pr.author?.login ?? 'ghost',
        createdAt: pr.createdAt,
        mergedAt: pr.mergedAt,
        additions: pr.additions,
        deletions: pr.deletions,
        changedFiles: pr.changedFiles,
        headRef: pr.headRefName,
        baseRef: pr.baseRefName,
        headRefOid: pr.headRefOid,
        reviews: pr.reviews.nodes.map(r => ({
          author: r.author?.login ?? 'ghost',
          state: r.state,
          submittedAt: r.submittedAt,
        })),
      })
    }
    fetchedCount += open.length + merged.length
    console.log(`✓ ${repo.name}: ${open.length} abertos, ${merged.length} mergeados atualizados (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
  }
  catch (err) {
    console.error(`✗ ${repo.name}: ${(err as Error).message}`)
    // rede de segurança: repo que falhou não pode sumir do painel — reaproveita
    // o cache, mas só nos estados que o modelo conhece (OPEN/MERGED): um cache
    // legado/corrompido não pode re-propagar CLOSED todo santo dia. Mergeados
    // sem mergedAt válido não têm como respeitar a janela — descartados.
    let restored = 0
    for (const p of cached?.prs ?? []) {
      if (p.repo !== repo.name)
        continue
      if (p.state !== 'OPEN' && p.state !== 'MERGED')
        continue
      if (p.state === 'MERGED' && (typeof p.mergedAt !== 'string' || Number.isNaN(Date.parse(p.mergedAt)) || new Date(p.mergedAt) < windowCutoff))
        continue
      // pass-through da linha inteira do cache: quem tem headRef/baseRef/headRefOid mantém; linhas antigas seguem sem (nunca inventar)
      fresh.set(`${p.repo}#${p.number}`, p)
      restored++
    }
    if (restored)
      console.log(`  ↳ ${restored} PRs mantidos do cache anterior`)
  }
})

// merge: preserva mergeados anteriores que o fetch incremental não revalidou;
// abertos NÃO são preservados — a lista fresca de OPEN é a verdade
// (PR fechado sem merge some do painel, como no modo completo)
let kept = 0
if (prev) {
  // mergeados fora da janela de MERGED_CUTOFF_DAYS expiram (o incremental não os revalida mais);
  // MERGED sem mergedAt válido é descartado (não tem como janelar — o check-data o reprovaria)
  for (const p of prev.prs) {
    const key = `${p.repo}#${p.number}`
    if (p.state !== 'MERGED' || fresh.has(key))
      continue
    const mergedAt = p.mergedAt as string | null
    if (!mergedAt || Number.isNaN(Date.parse(mergedAt)) || new Date(mergedAt) < windowCutoff)
      continue
    // pass-through da linha inteira: o preserve mantém headRef/baseRef/headRefOid de quem tem e não inventa para quem não tem
    fresh.set(key, p)
    kept++
  }
}

const allPrs = [...fresh.values()]

// logins -> usuários, calculado sobre o conjunto final (frescos + preservados)
const seenLogins = new Set<string>()
for (const p of allPrs) {
  seenLogins.add(p.author)
  for (const r of p.reviews) {
    if (r.author)
      seenLogins.add(r.author)
  }
}

// logins sem mapeamento para nome do time (avisar pra completar o config)
const unmapped = [...seenLogins]
  .filter(l => !userMap.has(l.toLowerCase()) && !isBotLogin(l))
  .sort()

const users: Record<string, { name: string, bot: boolean }> = {}
for (const login of seenLogins) {
  users[login] = { name: userMap.get(login.toLowerCase()) ?? login, bot: isBotLogin(login) }
}

writeFileSync(outFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  users,
  prs: allPrs,
}))

console.log(`\n✓ github.json: ${allPrs.length} PRs (${fetchedCount} buscados, ${kept} mergeados preservados) de ${repos.length - skipped} repos`)
if (outOfWindow)
  console.log(`⚑ ${outOfWindow} PRs mergeados fora da janela de ${MERGED_CUTOFF_DAYS} dias descartados`)
if (unmapped.length) {
  console.log(`⚠ logins sem mapeamento (associe em /teams): ${unmapped.join(', ')}`)
}
