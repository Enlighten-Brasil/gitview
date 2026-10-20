import type { Config } from './config'
import { Buffer } from 'node:buffer'
/**
 * Descoberta e manutenção dos repositórios locais usados pelos coletores.
 *
 * Aceita dois formatos:
 * - checkout normal (pasta com `.git`) — o dev aponta pro próprio workspace
 * - clone bare gerenciado pelo `pnpm setup` em `data/repos/` — sem working
 *   tree, recebe `git fetch` automático no início da coleta
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import process from 'node:process'
import { resolveReposRoot, rootDir } from './config'

export interface RepoInfo { name: string, path: string }

/** pasta onde o `pnpm setup` clona os repos selecionados (bare) */
export const MANAGED_REPOS_DIR = join(rootDir, 'data', 'repos')

/** dir com `.git` (checkout/worktree) ou bare (HEAD + objects + refs) */
export function isGitRepo(path: string): boolean {
  if (existsSync(join(path, '.git')))
    return true
  return existsSync(join(path, 'HEAD'))
    && existsSync(join(path, 'objects'))
    && existsSync(join(path, 'refs'))
}

export function discoverRepos(reposRoot: string, exclude: string[] = []): RepoInfo[] {
  const excluded = new Set(exclude)
  const found: RepoInfo[] = []
  if (isGitRepo(reposRoot)) {
    // split nunca termina vazio — `?? ''` só pro tipo
    found.push({ name: reposRoot.split(/[\\/]/).pop() ?? '', path: reposRoot })
  }
  for (const entry of readdirSync(reposRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || excluded.has(entry.name))
      continue
    const p = join(reposRoot, entry.name)
    if (isGitRepo(p))
      found.push({ name: entry.name, path: p })
  }
  return found.sort((a, b) => a.name.localeCompare(b.name))
}

/** clone gerenciado pelo setup (vive em data/repos) — recebe fetch automático */
export function isManagedRepo(path: string): boolean {
  const r = resolve(path)
  return r === MANAGED_REPOS_DIR || r.startsWith(MANAGED_REPOS_DIR + sep)
}

/** resolveReposRoot sem lançar erro — null quando nada está configurado */
export function resolveReposRootSafe(config: Config): string | null {
  try {
    return resolveReposRoot(config)
  }
  catch {
    return null
  }
}

export function remoteOf(path: string): string | null {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: path, encoding: 'utf-8' })
  return r.status === 0 ? r.stdout.trim() || null : null
}

/** git@github.com:Owner/repo.git | https://github.com/Owner/repo(.git) -> Owner/repo */
export function parseGitHub(remote: string): { owner: string, repo: string } | null {
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i)
  return m ? { owner: m[1], repo: m[2] } : null
}

/**
 * Env do git com o token injetado por variável GIT_CONFIG_* (equivalente a
 * `-c`, mas sem vazar no argv dos processos): o header basic x-access-token
 * vale só para o comando — o token nunca fica gravado em config do clone.
 */
export function gitAuthEnv(token?: string | null): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
  if (token) {
    const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
    env.GIT_CONFIG_COUNT = '1'
    env.GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader'
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${basic}`
  }
  return env
}

/**
 * Refspec de fetch dos clones gerenciados (issue #140): `git clone --bare` NÃO
 * grava `remote.origin.fetch` (o git só grava refspec em clone normal), e num
 * bare sem refspec o `git fetch --all --prune --tags` só escreve o FETCH_HEAD —
 * `refs/heads/*` não avança nem é podado, e o clone congela na data de criação.
 * Idempotente: grava `+refs/heads/*:refs/heads/*` só quando a chave está
 * ausente — clones antigos se auto-curam no primeiro fetch pós-fix.
 */
export function ensureFetchRefspec(path: string): void {
  const atual = spawnSync('git', ['-C', path, 'config', '--get', 'remote.origin.fetch'], { encoding: 'utf-8' })
  if (atual.status === 0 && atual.stdout.trim())
    return
  spawnSync('git', ['-C', path, 'config', 'remote.origin.fetch', '+refs/heads/*:refs/heads/*'], { stdio: 'ignore' })
}

/**
 * git fetch autenticado (token via gitAuthEnv) e tolerante a falha: repo sem
 * acesso ou rede fora não derruba a coleta — usa o cache local e avisa.
 * GIT_TERMINAL_PROMPT=0 evita prompt interativo de credencial travando o processo.
 */
export function fetchRepo(path: string, token?: string | null): Promise<string | null> {
  // Backfill idempotente (issue #140): clones gerenciados criados antes do fix
  // não têm remote.origin.fetch — sem ele, o fetch abaixo só grava FETCH_HEAD e
  // os refs congelam. Este é o ponto central (o collect chama fetchRepo só nos
  // clones gerenciados); clone novo já nasce com o refspec via cloneBare.
  ensureFetchRefspec(path)
  return new Promise((resolvePromise) => {
    const child = spawn('git', ['-C', path, 'fetch', '--all', '--prune', '--tags', '--quiet'], {
      env: gitAuthEnv(token),
    })
    const errChunks: Buffer[] = []
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', e => resolvePromise(String(e)))
    child.on('close', code => resolvePromise(code === 0 ? null : Buffer.concat(errChunks).toString('utf-8').trim()))
  })
}

/**
 * Remove o header de auth que versões antigas gravavam no config do clone
 * (token em repouso no .git/config de cada clone em data/repos). Idempotente
 * — o collect roda a cada execução nos clones gerenciados.
 */
export function scrubPersistedToken(path: string): void {
  spawnSync('git', ['-C', path, 'config', '--unset-all', 'http.https://github.com/.extraheader'], { stdio: 'ignore' })
}

/**
 * Trava de read-only no nível do git: sobrescreve a URL de push do origin,
 * então `git push` falha mesmo que a credencial do clone permita escrita
 * (escopo repo do OAuth/gh é read+write — a garantia aqui é no remote).
 * Idempotente — o collect reaplica nos clones gerenciados a cada execução.
 */
export function denyPush(path: string): void {
  spawnSync('git', ['-C', path, 'config', 'remote.origin.pushurl', 'no-push'], { stdio: 'ignore' })
}

/**
 * Clone bare autenticado pelo token (via gitAuthEnv — nada de token no argv
 * nem no config do clone). Sem token, falha com mensagem clara: a auth vem do
 * setup da UI (device flow/PAT) ou do bridge do `gh` no getToken(). Todo clone
 * sai com o refspec de fetch gravado (ensureFetchRefspec — sem ele o
 * `fetch --prune` congela os refs, issue #140) e push travado (denyPush) — o
 * gitview nunca escreve nos remotes.
 */
export function cloneBare(fullName: string, dest: string, token?: string | null): Promise<string | null> {
  return new Promise((resolvePromise) => {
    if (!token) {
      resolvePromise('sem token do GitHub — conecte sua conta no passo 1 do setup')
      return
    }
    const child = spawn('git', ['clone', '--bare', '--quiet', `https://github.com/${fullName}.git`, dest], {
      env: gitAuthEnv(token),
    })
    const errChunks: Buffer[] = []
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', e => resolvePromise(String(e)))
    child.on('close', (code) => {
      if (code !== 0) {
        resolvePromise(Buffer.concat(errChunks).toString('utf-8').trim())
        return
      }
      // Refspec na criação (issue #140): `clone --bare` não grava
      // remote.origin.fetch. Pós-clone via git config (mesmo helper do backfill
      // no fetchRepo) — `--config` no próprio comando clone foi medido e NÃO é
      // equivalente: duplica o mapeamento do fetch inicial e o clone morre com
      // "multiple updates for ref not allowed" (git 2.53.0.windows.3).
      ensureFetchRefspec(dest)
      denyPush(dest)
      resolvePromise(null)
    })
  })
}

/** map assíncrono com concorrência limitada */
export async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++]
      await fn(item)
    }
  }))
}
