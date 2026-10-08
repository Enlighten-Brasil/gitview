/**
 * Config compartilhada dos coletores.
 *
 * - `config.json` (versionado): mapeamentos do time (authors, githubUsers, bots)
 *   e defaults. Todo mundo que clona herda.
 * - `config.local.json` (gitignored): overrides por máquina — principalmente
 *   `reposRoot`, que é diferente no PC de cada dev.
 * - env `GITVIEW_REPOS_ROOT` tem prioridade máxima.
 * - fallback: pasta `example` irmã do clone do gitview (layout padrão do time).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface Config {
  reposRoot?: string
  /** org do GitHub listada pelo `pnpm setup` (ex.: "Enlighten-Brasil") */
  githubOrg?: string
  /** repos pré-selecionados no `pnpm setup` (Enter/--yes); fallback = todos não arquivados */
  defaultRepos?: string[]
  exclude?: string[]
  /** Nome canônico -> lista de e-mails (alias) */
  authors?: Record<string, string[]>
  bots?: string[]
  /** login do GitHub (case-insensitive) -> nome canônico do time */
  githubUsers?: Record<string, string>
  githubBots?: string[]
}

/** raiz do projeto gitview (pasta acima de scripts/) */
export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

function readJson(path: string): Config {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) as Config : {}
}

export function loadConfig(): Config {
  const shared = readJson(join(rootDir, 'config.json'))
  const local = readJson(join(rootDir, 'config.local.json'))
  // merge raso: o local sobrescreve chave a chave (uso típico: só reposRoot)
  return { ...shared, ...local }
}

/**
 * Resolve a pasta que contém os repositórios do time.
 * Ordem: env GITVIEW_REPOS_ROOT → config.local.json → config.json → ../example.
 */
export function resolveReposRoot(config: Config): string {
  const candidates: { label: string; path: string }[] = []
  if (process.env.GITVIEW_REPOS_ROOT) {
    candidates.push({ label: 'env GITVIEW_REPOS_ROOT', path: process.env.GITVIEW_REPOS_ROOT })
  }
  if (config.reposRoot) {
    candidates.push({ label: 'reposRoot do config', path: config.reposRoot })
  }
  candidates.push({ label: 'auto-detect', path: join(rootDir, '..', 'example') })

  for (const c of candidates) {
    // caminhos relativos são resolvidos a partir da raiz do projeto
    const abs = resolve(rootDir, c.path)
    if (existsSync(abs)) return abs
  }

  const tried = candidates.map(c => `  - ${c.label}: ${c.path}`).join('\n')
  throw new Error(
    `pasta de repositórios não encontrada. Tentativas:\n${tried}\n\n`
    + `Configure uma das opções:\n`
    + `  1. rode \`pnpm setup\` para escolher e clonar os repos da org (recomendado)\n`
    + `  2. crie config.local.json na raiz: { "reposRoot": "C:/caminho/para/example" }\n`
    + `  3. ou defina a variável de ambiente GITVIEW_REPOS_ROOT`,
  )
}
