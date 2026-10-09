/**
 * Config do gitview: `.env` (máquina + segredos) + `team.local.json` (time).
 *
 * - `.env` (gitignored, criado do `.env.example` na 1ª execução): token e client
 *   id do GitHub, org, pasta dos repos, repos padrão/excluídos e porta do dev
 *   server. Variáveis de ambiente do shell têm prioridade sobre o arquivo.
 * - `team.local.json` (gitignored): perfis de devs, times e bots extras —
 *   editados pela UI em /team. Não é regenerável: `pnpm clean` não o toca.
 * - O formato antigo (config.json + config.local.json) migra uma vez via
 *   `scripts/lib/legacy.ts`, disparado por loadConfig().
 *
 * O `.env` NUNCA é carregado no process.env do processo (envDir: false no
 * Vite + parse próprio aqui): os coletores rodam como filhos do dev server e
 * precisam ler o arquivo fresco — token novo vale sem reiniciar nada.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { migrateLegacyConfig } from './legacy'

export interface DevProfile {
  /** cargo/função (ex.: "Gerente de desenvolvimento") */
  title?: string
  /** nota livre (foco, squad, observações) */
  description?: string
  /** e-mails de commit deste dev (alias no git) */
  emails?: string[]
  /** logins do GitHub deste dev (case-insensitive) */
  githubLogins?: string[]
}

export interface TeamConfig {
  name: string
  description?: string
  /** cor do badge (hex) — opcional */
  color?: string
  /** nomes canônicos dos devs */
  members: string[]
}

export interface Config {
  /** org do GitHub usada pelo setup e pela importação de times */
  githubOrg?: string
  /** client_id (público) do OAuth/GitHub App — habilita o device flow na UI */
  githubClientId?: string
  /** token do GitHub (device flow, PAT colado ou .env manual) — NUNCA versionar */
  githubToken?: string
  /** pasta que contém os repositórios (absoluta ou relativa à raiz) */
  reposRoot?: string
  /** repos pré-selecionados no setup */
  defaultRepos?: string[]
  /** pastas ignoradas na descoberta de repos */
  exclude?: string[]
  /** porta do dev server */
  port?: number
  /** perfis de devs (aliases de e-mail/login, título, descrição) */
  devProfiles?: Record<string, DevProfile>
  /** times do dashboard */
  teams?: TeamConfig[]
  /** nomes canônicos de bot no git (além do padrão `[bot]`) */
  bots?: string[]
  /** logins de bot no GitHub (a soma com a lista default) */
  githubBots?: string[]
}

/** raiz do projeto gitview (pasta acima de scripts/) */
export const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

const envPath = join(rootDir, '.env')
const envExamplePath = join(rootDir, '.env.example')
/** arquivo de config do time (gitignored) — exportado p/ legacy.ts e limpeza */
export const teamConfigPath = join(rootDir, 'team.local.json')

/** chave do .env -> campo do Config */
const ENV_KEYS: Record<string, keyof Config> = {
  GITVIEW_GITHUB_CLIENT_ID: 'githubClientId',
  GITVIEW_GITHUB_TOKEN: 'githubToken',
  GITVIEW_GITHUB_ORG: 'githubOrg',
  GITVIEW_REPOS_ROOT: 'reposRoot',
  GITVIEW_DEFAULT_REPOS: 'defaultRepos',
  GITVIEW_EXCLUDE: 'exclude',
  GITVIEW_PORT: 'port',
}

/** campos que vivem no team.local.json (não vão para o .env) */
const TEAM_FIELDS = new Set<keyof Config>(['devProfiles', 'teams', 'bots', 'githubBots'])

function parseCsv(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

function readParsedEnv(path: string): Record<string, string | undefined> {
  if (!existsSync(path)) return {}
  return parseEnv(readFileSync(path, 'utf-8'))
}

/** `.env` inexistente é criado a partir do `.env.example` (1ª execução) */
export function ensureEnvFile(): void {
  if (existsSync(envPath)) return
  const seed = existsSync(envExamplePath) ? readFileSync(envExamplePath, 'utf-8') : ''
  writeFileSync(envPath, seed)
}

let warnedNewKeys = false
/** avisa (1x por processo) quando o .env.example ganhou chaves que o .env não tem */
function warnNewEnvKeys(current: Record<string, string | undefined>): void {
  if (warnedNewKeys || !existsSync(envExamplePath)) return
  warnedNewKeys = true
  const missing = Object.keys(readParsedEnv(envExamplePath))
    .filter(k => !(k in current) && !process.env[k]?.trim())
  if (missing.length) console.warn(`! .env sem chaves novas do .env.example: ${missing.join(', ')}`)
}

/** shell > .env; vazio/espacos contam como "não definido" */
function envValue(key: string, file: Record<string, string | undefined>): string | undefined {
  const value = process.env[key]?.trim() || file[key]?.trim()
  return value || undefined
}

function readTeamFile(): Partial<Config> {
  if (!existsSync(teamConfigPath)) return {}
  try {
    return JSON.parse(readFileSync(teamConfigPath, 'utf-8')) as Partial<Config>
  }
  catch (err) {
    throw new Error(`team.local.json inválido: ${(err as Error).message}`)
  }
}

/** carrega a config efetiva: .env (+ shell) + team.local.json, migrando o legado antes */
export function loadConfig(): Config {
  ensureEnvFile()
  migrateLegacyConfig()
  const file = readParsedEnv(envPath)
  warnNewEnvKeys(file)
  const config: Config = {}

  const clientId = envValue('GITVIEW_GITHUB_CLIENT_ID', file)
  if (clientId) config.githubClientId = clientId
  const token = envValue('GITVIEW_GITHUB_TOKEN', file)
  if (token) config.githubToken = token
  const org = envValue('GITVIEW_GITHUB_ORG', file)
  if (org) config.githubOrg = org
  const root = envValue('GITVIEW_REPOS_ROOT', file)
  if (root) config.reposRoot = root
  const defaults = envValue('GITVIEW_DEFAULT_REPOS', file)
  if (defaults) config.defaultRepos = parseCsv(defaults)
  const exclude = envValue('GITVIEW_EXCLUDE', file)
  if (exclude) config.exclude = parseCsv(exclude)
  const port = envValue('GITVIEW_PORT', file)
  if (port) {
    const n = Number(port)
    if (Number.isInteger(n) && n > 0 && n < 65536) config.port = n
  }

  return { ...config, ...readTeamFile() }
}

/** valor .env entre aspas simples (sem expansão de escapes no parseEnv) */
function quoteEnvValue(key: string, value: string): string {
  if (!value) return ''
  if (/[\r\n]/.test(value)) throw new Error(`.env: valor de ${key} não pode ter quebra de linha`)
  if (value.includes("'")) throw new Error(`.env: valor de ${key} com aspa simples não é suportado`)
  return `'${value}'`
}

/**
 * Grava/atualiza chaves no `.env` linha a linha (preserva comentários e ordem;
 * cria as novas no fim). Valor vazio = linha `KEY=` (chave existe, desligada).
 */
export function upsertEnvFile(entries: Record<string, string>): void {
  ensureEnvFile()
  let text = readFileSync(envPath, 'utf-8')
  if (!text.endsWith('\n')) text += '\n'
  const lines = text.split(/\r?\n/)
  for (const [key, raw] of Object.entries(entries)) {
    if (!ENV_KEYS[key]) throw new Error(`chave .env desconhecida: ${key}`)
    const value = quoteEnvValue(key, raw)
    const idx = lines.findIndex(l => l.startsWith(`${key}=`))
    if (idx >= 0) lines[idx] = `${key}=${value}`
    else lines.push(`${key}=${value}`)
  }
  writeFileSync(envPath, `${lines.join('\n')}`)
}

/**
 * Persiste um patch de config roteando cada campo para o lugar certo:
 * máquina/segredos → `.env`; time (perfis/times/bots) → `team.local.json`.
 */
export function saveConfig(patch: Partial<Config>): void {
  const envEntries: Record<string, string> = {}
  const teamPatch: Partial<Config> = {}
  for (const [field, value] of Object.entries(patch) as [keyof Config, unknown][]) {
    if (value === undefined) continue
    const envKey = Object.keys(ENV_KEYS).find(k => ENV_KEYS[k] === field)
    if (envKey) {
      envEntries[envKey] = Array.isArray(value)
        ? (value as string[]).join(',')
        : String(value)
    }
    else if (TEAM_FIELDS.has(field)) {
      teamPatch[field] = value as never
    }
  }
  if (Object.keys(envEntries).length) upsertEnvFile(envEntries)
  if (Object.keys(teamPatch).length) {
    const current = existsSync(teamConfigPath) ? readTeamFile() : {}
    writeFileSync(teamConfigPath, `${JSON.stringify({ ...current, ...teamPatch }, null, 2)}\n`)
  }
}

/**
 * Resolve a pasta que contém os repositórios do time.
 * Ordem: GITVIEW_REPOS_ROOT (shell/.env) → data/repos (clones do setup).
 */
export function resolveReposRoot(config: Config): string {
  const candidates: { label: string; path: string }[] = []
  if (config.reposRoot) candidates.push({ label: 'GITVIEW_REPOS_ROOT (.env/shell)', path: config.reposRoot })
  candidates.push({ label: 'padrão do setup', path: join(rootDir, 'data', 'repos') })

  for (const c of candidates) {
    // caminhos relativos são resolvidos a partir da raiz do projeto
    const abs = resolve(rootDir, c.path)
    if (existsSync(abs)) return abs
  }

  const tried = candidates.map(c => `  - ${c.label}: ${c.path}`).join('\n')
  throw new Error(
    `pasta de repositórios não encontrada. Tentativas:\n${tried}\n\n`
    + `Configure uma das opções:\n`
    + `  1. rode \`pnpm dev\` e abra /setup para conectar o GitHub e clonar os repos (recomendado)\n`
    + `  2. defina GITVIEW_REPOS_ROOT no .env apontando para uma pasta de clones\n`
    + `  3. ou rode \`pnpm setup\` no terminal`,
  )
}
