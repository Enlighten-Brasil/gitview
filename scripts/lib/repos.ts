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
import { type Config, resolveReposRoot, rootDir } from './config'

export interface RepoInfo { name: string; path: string }

/** pasta onde o `pnpm setup` clona os repos selecionados (bare) */
export const MANAGED_REPOS_DIR = join(rootDir, 'data', 'repos')

/** dir com `.git` (checkout/worktree) ou bare (HEAD + objects + refs) */
export function isGitRepo(path: string): boolean {
  if (existsSync(join(path, '.git'))) return true
  return existsSync(join(path, 'HEAD'))
    && existsSync(join(path, 'objects'))
    && existsSync(join(path, 'refs'))
}

export function discoverRepos(reposRoot: string, exclude: string[] = []): RepoInfo[] {
  const excluded = new Set(exclude)
  const found: RepoInfo[] = []
  if (isGitRepo(reposRoot)) {
    found.push({ name: reposRoot.split(/[\\/]/).pop()!, path: reposRoot })
  }
  for (const entry of readdirSync(reposRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || excluded.has(entry.name)) continue
    const p = join(reposRoot, entry.name)
    if (isGitRepo(p)) found.push({ name: entry.name, path: p })
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
export function parseGitHub(remote: string): { owner: string; repo: string } | null {
  const m = remote.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i)
  return m ? { owner: m[1], repo: m[2] } : null
}

/**
 * git fetch tolerante a falha: repo sem acesso ou rede fora não derruba a
 * coleta — usa o cache local e avisa. GIT_TERMINAL_PROMPT=0 evita prompt
 * interativo de credencial travando o processo.
 */
export function fetchRepo(path: string): Promise<string | null> {
  return new Promise((resolvePromise) => {
    const child = spawn('git', ['-C', path, 'fetch', '--all', '--prune', '--tags', '--quiet'], {
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    })
    const errChunks: Buffer[] = []
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', e => resolvePromise(String(e)))
    child.on('close', code => resolvePromise(code === 0 ? null : Buffer.concat(errChunks).toString('utf-8').trim()))
  })
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
 * clone bare autenticado. Com token: git puro — `-c` do clone grava o
 * http.extraheader (Basic x-access-token, aceito por PAT/OAuth/GitHub App)
 * no config do novo repo, então os fetches futuros já saem autenticados
 * (token local da máquina, em pasta gitignored). Sem token: fallback pro
 * `gh repo clone` (usa a auth do gh CLI). Todo clone sai com push travado
 * (denyPush) — o gitview nunca escreve nos remotes.
 */
export function cloneBare(fullName: string, dest: string, token?: string): Promise<string | null> {
  return new Promise((resolvePromise) => {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    const basic = token ? Buffer.from(`x-access-token:${token}`).toString('base64') : ''
    const child = token
      ? spawn('git', ['clone', '-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`, '--bare', '--quiet', `https://github.com/${fullName}.git`, dest], { env })
      : spawn('gh', ['repo', 'clone', fullName, dest, '--', '--bare', '--quiet'], { env })
    const errChunks: Buffer[] = []
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', e => resolvePromise(String(e)))
    child.on('close', (code) => {
      if (code !== 0) {
        resolvePromise(Buffer.concat(errChunks).toString('utf-8').trim())
        return
      }
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
