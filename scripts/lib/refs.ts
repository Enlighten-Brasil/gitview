/**
 * Refs de produção e integração por repo (seam consumido pelos coletores).
 *
 * - Produção (`resolveProdRef`): a branch que representa o que está em
 *   produção. O valor explícito da config (GITVIEW_PRODUCTION_REF, global)
 *   vale quando o ref existe no repo; senão a detecção automática roda por
 *   repo: `refs/remotes/origin/HEAD` (checkout normal) → `HEAD` (clone bare) →
 *   `main` → `master`. Valor explícito inexistente cai no automático com
 *   `console.warn` nomeando o repo. Repo com commits e sem ref de produção
 *   resolvível é ERRO com mensagem clara — nunca ∅ silencioso.
 * - Integração (`resolveIntegRefs`): lista da config (default
 *   develop,staging) filtrada por existência no repo. Lista vazia é estado
 *   legítimo: sem aviso, sem erro (repo sem develop simplesmente não tem).
 *
 * Aceita os dois formatos do discoverRepos (scripts/lib/repos.ts): em clone
 * bare os refs vivem em `refs/heads/*` e `refs/remotes/origin/HEAD`
 * normalmente não existe; em checkout normal o HEAD é a branch correntemente
 * checada (pode ser uma feature!), então a resolução correta começa em
 * `refs/remotes/origin/HEAD`.
 *
 * FORMA DO RETORNO (issue #141): os resolvedores devolvem o CANDIDATO QUE
 * CASOU — nome curto quando a forma curta/local existe (clones bare e
 * checkouts normais com branch local: byte-idêntico ao histórico), forma
 * longa `refs/remotes/origin/NOME` quando só a remota existe (checkout
 * normal sem branch local de produção — o nome curto não seria resolvível
 * pelos consumidores git: rev-list de scope.ts, ahead/behind de
 * collect-branches). O contrato é "retorna um ref que o git resolve". Para
 * EXIBIÇÃO (ref_hint, branches.json, hint de /settings) use
 * `displayRefName` no valor retornado — os JSONs e o banco seguem com nome
 * curto.
 *
 * DESEMPENHO (issue #134): a resolução é memoizada por processo (chave
 * repoPath + valor de config — mesmo padrão do warnedProd) e existe API
 * async opcional (`resolveProdRefAsync`/`resolveIntegRefsAsync`, spawn
 * streaming padrão runGit de lib/scope.ts) para consumidores que não podem
 * bloquear o event loop (setup-plugin no dev server). Os coletores são
 * one-shot (processo novo por execução) e só resolvem DEPOIS do fetch, então
 * o cache não envelhece dentro de um processo.
 */
import { Buffer } from 'node:buffer'
import { spawn, spawnSync } from 'node:child_process'
import { basename } from 'node:path'

/** refs de integração quando GITVIEW_INTEGRATION_REFS está vazio */
export const DEFAULT_INTEGRATION_REFS = ['develop', 'staging']

/**
 * Nome de EXIBIÇÃO de um ref: `main` de `refs/heads/main`; `main` de
 * `refs/remotes/origin/main` e `origin/main`. Os pontos de exibição
 * (ref_hint, campos do branches.json, hint de /settings) aplicam este helper
 * ao valor dos resolvedores, que pode vir na forma longa (#141).
 */
export function displayRefName(ref: string): string {
  return ref
    .replace(/^refs\/remotes\/origin\//, '')
    .replace(/^refs\/heads\//, '')
    .replace(/^origin\//, '')
}

/** o nome como dado, a forma local e a forma remota (nesta ordem) */
function refCandidates(name: string): string[] {
  return [name, `refs/heads/${name}`, `refs/remotes/origin/${name}`]
}

/** `git rev-parse -q --verify <ref>^{commit}`: o ref existe E aponta para um commit */
function hasCommit(repoPath: string, ref: string): boolean {
  const r = spawnSync(
    'git',
    ['-C', repoPath, 'rev-parse', '-q', '--verify', `${ref}^{commit}`],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
  )
  return r.status === 0 && r.stdout.trim().length > 0
}

/** alvo de um symbolic-ref (ex.: HEAD → refs/heads/main) — null se ausente/detached */
function symbolicRef(repoPath: string, ref: string): string | null {
  const r = spawnSync(
    'git',
    ['-C', repoPath, 'symbolic-ref', '-q', ref],
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] },
  )
  return r.status === 0 ? r.stdout.trim() || null : null
}

/** o CANDIDATO QUE CASOU (forma resolvível, ordem de refCandidates) — senão null */
function findExisting(repoPath: string, name: string): string | null {
  return refCandidates(name).find(c => hasCommit(repoPath, c)) ?? null
}

/** git async sem rejeitar por exit≠0 (nos resolvedores ≠0 = "não existe") — padrão runGit de lib/scope.ts */
function gitOut(repoPath: string, args: string[]): Promise<{ status: number, stdout: string }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', ['-C', repoPath, ...args], { stdio: ['ignore', 'pipe', 'ignore'] })
    const chunks: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => chunks.push(c))
    child.on('error', reject)
    child.on('close', code => resolvePromise({ status: code ?? 1, stdout: Buffer.concat(chunks).toString('utf-8') }))
  })
}

async function hasCommitAsync(repoPath: string, ref: string): Promise<boolean> {
  const r = await gitOut(repoPath, ['rev-parse', '-q', '--verify', `${ref}^{commit}`])
  return r.status === 0 && r.stdout.trim().length > 0
}

async function symbolicRefAsync(repoPath: string, ref: string): Promise<string | null> {
  const r = await gitOut(repoPath, ['symbolic-ref', '-q', ref])
  return r.status === 0 ? r.stdout.trim() || null : null
}

/** espelho async de findExisting — mesmos candidatos, mesma ordem */
async function findExistingAsync(repoPath: string, name: string): Promise<string | null> {
  for (const candidate of refCandidates(name)) {
    if (await hasCommitAsync(repoPath, candidate))
      return candidate
  }
  return null
}

/** memoização por processo (#134): mesma chave custa ~0; erros não memoizados (guard relança e re-resolve) */
const prodCache = new Map<string, string>()
const integCache = new Map<string, string[]>()

/** warn de produção inválida: 1× por processo/repo/valor (a coleta resolve o repo várias vezes) */
const warnedProd = new Set<string>()

/** warn do fallback de produção, com dedupe por processo (mesmo texto do comportamento original) */
function warnProdFallback(repoPath: string, repo: string, explicit: string, found: string): void {
  const key = `${repoPath}\0${explicit}`
  if (!warnedProd.has(key)) {
    warnedProd.add(key)
    console.warn(`! ${repo}: GITVIEW_PRODUCTION_REF "${explicit}" não existe no repo — produção cai para a detecção automática (${displayRefName(found)})`)
  }
}

/** erro do guard do prod=∅ silencioso (mensagem única para sync e async) */
function prodError(repo: string, explicit: string | undefined, tried: string): Error {
  const why = explicit ? ` (GITVIEW_PRODUCTION_REF "${explicit}" não existe e a detecção automática falhou)` : ''
  return new Error(`${repo}: sem ref de produção resolvível${why}. Tentados: ${tried}. O repo precisa ter ao menos um commit numa dessas branches — verifique o clone ou defina GITVIEW_PRODUCTION_REF com um ref que exista no repo.`)
}

/**
 * Resolve a ref de produção de um repo. Retorna sempre um ref EXISTENTE e
 * RESOLVÍVEL pelo git (#141): nome curto quando a forma curta casa (bare e
 * checkout com branch local), forma longa `refs/remotes/origin/NOME` quando
 * só a remota existe. Ordem: valor explícito da config SE existir no repo →
 * `refs/remotes/origin/HEAD` → `HEAD` → `main` → `master`. Para exibição,
 * aplicar `displayRefName`. Valor explícito inexistente: `console.warn`
 * nomeando o repo + fallback. Nada resolvível: lança erro (guard do prod=∅
 * silencioso).
 */
export function resolveProdRef(repoPath: string, configValue?: string): string {
  const explicit = configValue?.trim() || undefined
  const key = `${repoPath}\0${explicit ?? ''}`
  const cached = prodCache.get(key)
  if (cached)
    return cached

  const repo = basename(repoPath)
  if (explicit) {
    const found = findExisting(repoPath, explicit)
    if (found) {
      prodCache.set(key, found)
      return found
    }
  }

  // detecção automática: origin/HEAD (checkout normal) → HEAD (bare) → main → master
  const auto: string[] = []
  const originHead = symbolicRef(repoPath, 'refs/remotes/origin/HEAD')
  if (originHead)
    auto.push(displayRefName(originHead))
  const head = symbolicRef(repoPath, 'HEAD')
  if (head)
    auto.push(displayRefName(head))
  auto.push('main', 'master')

  for (const candidate of [...new Set(auto)]) {
    const found = findExisting(repoPath, candidate)
    if (found) {
      if (explicit)
        warnProdFallback(repoPath, repo, explicit, found)
      prodCache.set(key, found)
      return found
    }
  }

  const tried = [...new Set([...(explicit ? [explicit] : []), ...auto])].join(', ')
  throw prodError(repo, explicit, tried)
}

/**
 * Espelho async de `resolveProdRef` (#134): spawn streaming (event loop
 * livre) para consumidores async. Mesma ordem de resolução, mesmos warns
 * (dedupe por processo) e mesmo guard — a diferença é só o transporte.
 */
export async function resolveProdRefAsync(repoPath: string, configValue?: string): Promise<string> {
  const explicit = configValue?.trim() || undefined
  const key = `${repoPath}\0${explicit ?? ''}`
  const cached = prodCache.get(key)
  if (cached)
    return cached

  const repo = basename(repoPath)
  if (explicit) {
    const found = await findExistingAsync(repoPath, explicit)
    if (found) {
      prodCache.set(key, found)
      return found
    }
  }

  // detecção automática: origin/HEAD (checkout normal) → HEAD (bare) → main → master
  const auto: string[] = []
  const originHead = await symbolicRefAsync(repoPath, 'refs/remotes/origin/HEAD')
  if (originHead)
    auto.push(displayRefName(originHead))
  const head = await symbolicRefAsync(repoPath, 'HEAD')
  if (head)
    auto.push(displayRefName(head))
  auto.push('main', 'master')

  for (const candidate of [...new Set(auto)]) {
    const found = await findExistingAsync(repoPath, candidate)
    if (found) {
      if (explicit)
        warnProdFallback(repoPath, repo, explicit, found)
      prodCache.set(key, found)
      return found
    }
  }

  const tried = [...new Set([...(explicit ? [explicit] : []), ...auto])].join(', ')
  throw prodError(repo, explicit, tried)
}

/**
 * Resolve as refs de integração de um repo: a lista da config (default
 * `develop,staging`) filtrada por existência no repo. `configValue` omitido
 * usa o default; lista explícita (mesmo vazia) é respeitada como dada.
 * Retorna os CANDIDATOS QUE CASARAM na ordem da lista (forma resolvível —
 * nome curto quando a forma curta casa, forma longa quando só a remota
 * existe; #141). Para exibição, aplicar `displayRefName`. Vazio é legítimo:
 * sem aviso/erro.
 */
export function resolveIntegRefs(repoPath: string, configValue?: string[]): string[] {
  const names = configValue ?? DEFAULT_INTEGRATION_REFS
  const key = `${repoPath}\0${names.join('\0')}`
  const cached = integCache.get(key)
  if (cached)
    return [...cached]

  const found: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name)
      continue
    const short = displayRefName(name)
    if (found.some(f => displayRefName(f) === short))
      continue
    const hit = findExisting(repoPath, name)
    if (hit)
      found.push(hit)
  }
  integCache.set(key, found)
  return [...found]
}

/** espelho async de `resolveIntegRefs` (#134) — mesma ordem/dedupe/retornos, spawn streaming */
export async function resolveIntegRefsAsync(repoPath: string, configValue?: string[]): Promise<string[]> {
  const names = configValue ?? DEFAULT_INTEGRATION_REFS
  const key = `${repoPath}\0${names.join('\0')}`
  const cached = integCache.get(key)
  if (cached)
    return [...cached]

  const found: string[] = []
  for (const raw of names) {
    const name = raw.trim()
    if (!name)
      continue
    const short = displayRefName(name)
    if (found.some(f => displayRefName(f) === short))
      continue
    const hit = await findExistingAsync(repoPath, name)
    if (hit)
      found.push(hit)
  }
  integCache.set(key, found)
  return [...found]
}
