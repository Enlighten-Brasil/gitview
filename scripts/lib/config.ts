/**
 * Config do gitview: `.env` (máquina + segredos) + `team.local.json` (time).
 *
 * - `.env` (gitignored, criado do `.env.example` na 1ª execução): token e client
 *   id do GitHub, org, pasta dos repos e repos padrão. Variáveis de ambiente do
 *   shell têm prioridade sobre o arquivo.
 * - `team.local.json` (gitignored): perfis de devs, times e bots extras —
 *   editados pela UI em /teams. Não é regenerável: `pnpm clean` não o toca.
 *
 * O `.env` NUNCA é carregado no process.env do processo (envDir: false no
 * Vite + parse próprio aqui): os coletores rodam como filhos do dev server e
 * precisam ler o arquivo fresco — token novo vale sem reiniciar nada.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { DEFAULT_INTEGRATION_REFS } from './refs'

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
  /** nomes anteriores do time (renomeado na UI /teams) — mantém links /teams/<nome> vivos */
  renamedFrom?: string[]
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
  /** globs de arquivos gerados ignorados nas métricas de linhas (ACRESCENTA à lista padrão) */
  excludePaths?: string[]
  /** fuso canônico dos buckets de tempo (issue #8); default America/Sao_Paulo */
  timezone?: string
  /** ref de produção (branch que representa o que está em produção); vazio = auto por repo (scripts/lib/refs.ts) */
  productionRef?: string
  /** refs de integração (default develop,staging); filtrada por existência em cada repo */
  integrationRefs?: string[]
  /** dias sem atividade para branch com aheadProd=0 virar "pousada" (issue #123); default 30 */
  branchStaleDays?: number
  /** commits por repo na janela de topologia dos graph-*.json (issue #126); inteiro > 0, default 1000 */
  graphWindow?: number
  /** nomes exatos de branches de bot (extras ao BOT_BRANCH_RE de lib/team.ts); comparação lowercase */
  botBranches?: string[]
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
/** arquivo de config do time (gitignored) */
export const teamConfigPath = join(rootDir, 'team.local.json')

/** chave do .env -> campo do Config */
const ENV_KEYS: Record<string, keyof Config> = {
  GITVIEW_GITHUB_CLIENT_ID: 'githubClientId',
  GITVIEW_GITHUB_TOKEN: 'githubToken',
  GITVIEW_GITHUB_ORG: 'githubOrg',
  GITVIEW_REPOS_ROOT: 'reposRoot',
  GITVIEW_DEFAULT_REPOS: 'defaultRepos',
  GITVIEW_EXCLUDE_PATHS: 'excludePaths',
  GITVIEW_TIMEZONE: 'timezone',
  GITVIEW_PRODUCTION_REF: 'productionRef',
  GITVIEW_INTEGRATION_REFS: 'integrationRefs',
  GITVIEW_BRANCH_STALE_DAYS: 'branchStaleDays',
  GITVIEW_BOT_BRANCHES: 'botBranches',
  GITVIEW_GRAPH_WINDOW: 'graphWindow',
}

/**
 * Arquivos gerados/lockfiles ignorados por padrão nas métricas de linhas —
 * sem isso um "chore: update version" carrega +300k de lockfile e distorce
 * tudo. GITVIEW_EXCLUDE_PATHS (CSV de globs) ACRESCENTA padrões a esta lista.
 */
export const DEFAULT_EXCLUDE_PATHS = [
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'bun.lock',
  'bun.lockb',
  'Cargo.lock',
  'composer.lock',
  'Gemfile.lock',
  'poetry.lock',
  'Pipfile.lock',
  'pubspec.lock',
  'Package.resolved',
  'go.sum',
  '*.min.js',
  '*.min.css',
  '*.min.map',
  '*.snap',
  '*.generated.ts',
  '*.generated.js',
  '*.designer.cs',
  // artefatos baked na issue #209 (pasta dist, pasta documentation e o
  // full_documentation.json). 'dist/**' e não 'dist/': padrão com '/' casa o
  // caminho todo TERMINANDO no padrão — 'dist/' só casaria a pasta em si, não
  // os arquivos dentro. 'full_documentation.json' (sem '/') casa por basename.
  'dist/**',
  'documentation/**',
  'full_documentation.json',
  // candidatos avaliados na issue #236 (amostra git log --numstat nos clones
  // reais + classificação por padrão de conteúdo). 'overwrites/**': cópias
  // vendored de pacotes npm de terceiros (repo A: 1497 arquivos, 97% tocados
  // exatamente 2x — cópia-entrada/cópia-saída — e depois migrados para
  // pacotes privados); 91k de additions num commit só. '*.apidog.json':
  // export serializado do Apidog (cabeçalho "apidogProject"/"$schema"
  // app:apidog; o README do gerador chama de "exports... JSON pronto para
  // importação") — 270k das 347k linhas de scripts/ do repo A. 'scripts/**'
  // NÃO entra: conteúdo misto (o gerador em JS/TS é fonte humana, ~55k de
  // origem contra 270k do export gerado) e a pasta em outros repos é fonte.
  'overwrites/**',
  '*.apidog.json',
  // candidato avaliado na issue #247 (mesmo método da #236: amostra git log
  // --numstat nos clones reais + classificação por padrão de conteúdo).
  // '.git-rewrite/**': scratch do `git filter-branch` commitada por engano no
  // repo A — 59k de additions em 2 commits (backup-refs/commit/heads/index +
  // map/<sha>), artefato puro da ferramenta. 'themes/**' e 'content/**'
  // avaliados e recusados: conteúdo misto — em themes/, tema vendorizado de
  // IdP convive com temas/SCSS/fontes autorados em src/**/themes; em content/,
  // demo de template convive com documentação autoral (content/ e
  // docs/**/content/).
  '.git-rewrite/**',
]

/**
 * glob simples: '*' dentro do segmento; '**' casa caminho qualquer; padrão com
 * '/' casa o caminho todo (em qualquer profundidade), sem '/' casa o basename.
 * Case-sensitive como gitignore.
 *
 * Matcher LINEAR sem regex (issue #269): a regex dinâmica antiga gerava
 * sequências de '.*' dos '**' com backtracking catastrófico (padrão '**a' x25
 * + 'z' contra path de 80 chars não resolvia nem em 15s — probe medido). Aqui é
 * DP O(tokens x path), sem backtrack. Semântica byte-idêntica à regex antiga,
 * inclusive nos quirks: TODO NUL do padrão virava '.*' (marcador de '**'
 * colidia) e '.' da regex não engole quebra de linha — a tabela-verdade diff-0
 * contra o oráculo legado fica pinada em test/config.test.ts.
 */
interface GlobToken {
  kind: 'lit' | 'star' | 'dstar'
  ch?: string
}

const NUL = String.fromCharCode(0)

function tokenizeGlob(pattern: string): GlobToken[] {
  const tokens: GlobToken[] = []
  for (let i = 0; i < pattern.length;) {
    const c = pattern[i]
    // '**' esquerda-pra-direita não-sobreposto (mesma ordem do replace antigo)
    if (c === '*' && pattern[i + 1] === '*') {
      tokens.push({ kind: 'dstar' })
      i += 2
    }
    else if (c === '*') {
      tokens.push({ kind: 'star' })
      i += 1
    }
    else if (c === NUL) {
      tokens.push({ kind: 'dstar' })
      i += 1
    }
    else {
      tokens.push({ kind: 'lit', ch: c })
      i += 1
    }
  }
  return tokens
}

const isLineTerm = (c: string): boolean => c === '\n' || c === '\r' || c === '\u2028' || c === '\u2029'

// cache por execução: os tokens só dependem do padrão, e o numstat chama
// isExcludedPath por (caminho × padrão) — sem cache recompilava milhares de
// vezes (o antigo globCache guardava a regex pré-compilada; follow-up #12)
const globTokens = new Map<string, GlobToken[]>()

export function matchesGlob(path: string, pattern: string): boolean {
  let tokens = globTokens.get(pattern)
  if (!tokens) {
    tokens = tokenizeGlob(pattern)
    globTokens.set(pattern, tokens)
  }
  // com '/': regex era '(^|.*/)body$' no path todo; sem '/': '^body$' no basename
  const withSlash = pattern.includes('/')
  const target = withSlash ? path : (path.split('/').pop() ?? path)
  const len = target.length
  let row = new Uint8Array(len + 1)
  if (withSlash) {
    // '(^|.*/)' na regex: o '.*' da alternativa pode começar em QUALQUER
    // posição (regex não ancora o grupo), então start válido é só 0 ou logo
    // após uma barra — o prefixo não precisa ser o começo do path
    for (let i = 0; i <= len; i++) {
      if (i === 0 || target[i - 1] === '/')
        row[i] = 1
    }
  }
  else {
    row[0] = 1
  }
  let next = new Uint8Array(len + 1)
  for (const tok of tokens) {
    next.fill(0)
    if (tok.kind === 'lit') {
      const ch = tok.ch
      for (let p = 0; p < len; p++) {
        if (row[p] && target[p] === ch)
          next[p + 1] = 1
      }
    }
    else if (tok.kind === 'star') {
      // '*' vira '[^/]*' — para na barra
      let ok = false
      for (let q = 0; q <= len; q++) {
        if (row[q])
          ok = true
        if (ok)
          next[q] = 1
        if (q < len && target[q] === '/')
          ok = false
      }
    }
    else {
      // '**' vira '.*' — consome qualquer run, menos quebra de linha
      let ok = false
      for (let q = 0; q <= len; q++) {
        if (row[q])
          ok = true
        if (ok)
          next[q] = 1
        if (q < len && isLineTerm(target[q]))
          ok = false
      }
    }
    const tmp = row
    row = next
    next = tmp
  }
  return row[len] === 1
}

/**
 * Dias sem atividade para uma branch sem commits à frente da produção
 * (aheadProd = 0) ser classificada como "pousada" no branches.json (issue
 * #123). 30 casa com o ciclo mensal de release; GITVIEW_BRANCH_STALE_DAYS
 * sobrescreve (inteiro >= 0 — inválido cai no default).
 */
export const DEFAULT_BRANCH_STALE_DAYS = 30

/**
 * Commits por repo na janela de topologia dos graph-*.json (issue #126,
 * coletor collect-graph.ts). A janela é CONTAGEM de commits, não dias: o
 * período coberto varia com a velocidade do repo (medido 2026-10-19 nos
 * clones reais: 1000 commits ≈ 87d no repo mais ativo; 300 cobriria só
 * ~38d). GITVIEW_GRAPH_WINDOW sobrescreve (inteiro > 0 — inválido/0/
 * negativo cai no default COM AVISO no loadConfig).
 */
export const DEFAULT_GRAPH_WINDOW = 1000

/** campos que vivem no team.local.json (não vão para o .env) */
const TEAM_FIELDS = new Set<keyof Config>(['devProfiles', 'teams', 'bots', 'githubBots'])

function parseCsv(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

function readParsedEnv(path: string): Record<string, string | undefined> {
  if (!existsSync(path))
    return {}
  return parseEnv(readFileSync(path, 'utf-8'))
}

/** `.env` inexistente é criado a partir do `.env.example` (1ª execução) */
export function ensureEnvFile(): void {
  if (existsSync(envPath))
    return
  const seed = existsSync(envExamplePath) ? readFileSync(envExamplePath, 'utf-8') : ''
  writeFileSync(envPath, seed)
}

let warnedNewKeys = false
/** avisa (1x por processo) quando o .env.example ganhou chaves que o .env não tem */
function warnNewEnvKeys(current: Record<string, string | undefined>): void {
  if (warnedNewKeys || !existsSync(envExamplePath))
    return
  warnedNewKeys = true
  const missing = Object.keys(readParsedEnv(envExamplePath))
    .filter(k => !(k in current) && !process.env[k]?.trim())
  if (missing.length)
    console.warn(`! .env sem chaves novas do .env.example: ${missing.join(', ')}`)
}

/** shell > .env; vazio/espacos contam como "não definido" */
function envValue(key: string, file: Record<string, string | undefined>): string | undefined {
  const value = process.env[key]?.trim() || file[key]?.trim()
  return value || undefined
}

function readTeamFile(): Partial<Config> {
  if (!existsSync(teamConfigPath))
    return {}
  try {
    return JSON.parse(readFileSync(teamConfigPath, 'utf-8')) as Partial<Config>
  }
  catch (err) {
    throw new Error(`team.local.json inválido: ${(err as Error).message}`)
  }
}

/** carrega a config efetiva: .env (+ shell) + team.local.json */
export function loadConfig(): Config {
  ensureEnvFile()
  const file = readParsedEnv(envPath)
  warnNewEnvKeys(file)
  const config: Config = {}

  const clientId = envValue('GITVIEW_GITHUB_CLIENT_ID', file)
  if (clientId)
    config.githubClientId = clientId
  const token = envValue('GITVIEW_GITHUB_TOKEN', file)
  if (token)
    config.githubToken = token
  const org = envValue('GITVIEW_GITHUB_ORG', file)
  if (org)
    config.githubOrg = org
  const root = envValue('GITVIEW_REPOS_ROOT', file)
  if (root)
    config.reposRoot = root
  const defaults = envValue('GITVIEW_DEFAULT_REPOS', file)
  if (defaults)
    config.defaultRepos = parseCsv(defaults)
  const excludePaths = envValue('GITVIEW_EXCLUDE_PATHS', file)
  config.excludePaths = [...DEFAULT_EXCLUDE_PATHS, ...(excludePaths ? parseCsv(excludePaths) : [])]
  const timezone = envValue('GITVIEW_TIMEZONE', file)
  if (timezone)
    config.timezone = timezone
  const productionRef = envValue('GITVIEW_PRODUCTION_REF', file)
  if (productionRef)
    config.productionRef = productionRef
  const integrationRefs = envValue('GITVIEW_INTEGRATION_REFS', file)
  config.integrationRefs = integrationRefs ? parseCsv(integrationRefs) : [...DEFAULT_INTEGRATION_REFS]
  const branchStaleDays = envValue('GITVIEW_BRANCH_STALE_DAYS', file)
  if (branchStaleDays) {
    // defensivo: saveConfig grava String(valor), mas o .env pode ser editado à mão
    const n = Number(branchStaleDays)
    if (Number.isInteger(n) && n >= 0)
      config.branchStaleDays = n
  }
  const botBranches = envValue('GITVIEW_BOT_BRANCHES', file)
  if (botBranches)
    config.botBranches = parseCsv(botBranches)
  const graphWindow = envValue('GITVIEW_GRAPH_WINDOW', file)
  if (graphWindow) {
    // inteiro > 0; inválido cai no default COM aviso (janela errada muda o
    // desenho do grafo inteiro — silêncio aqui esconderia o estrago)
    const n = Number(graphWindow)
    if (Number.isInteger(n) && n > 0)
      config.graphWindow = n
    else
      console.warn(`! GITVIEW_GRAPH_WINDOW inválido ("${graphWindow}") — esperado inteiro > 0; usando default ${DEFAULT_GRAPH_WINDOW}`)
  }

  return { ...config, ...readTeamFile() }
}

/** valor .env entre aspas simples (sem expansão de escapes no parseEnv) */
function quoteEnvValue(key: string, value: string): string {
  if (!value)
    return ''
  if (/[\r\n]/.test(value))
    throw new Error(`.env: valor de ${key} não pode ter quebra de linha`)
  if (value.includes('\''))
    throw new Error(`.env: valor de ${key} com aspa simples não é suportado`)
  return `'${value}'`
}

/**
 * Grava/atualiza chaves no `.env` linha a linha (preserva comentários e ordem;
 * cria as novas no fim). Valor vazio = linha `KEY=` (chave existe, desligada).
 */
export function upsertEnvFile(entries: Record<string, string>): void {
  ensureEnvFile()
  let text = readFileSync(envPath, 'utf-8')
  if (!text.endsWith('\n'))
    text += '\n'
  const lines = text.split(/\r?\n/)
  for (const [key, raw] of Object.entries(entries)) {
    if (!ENV_KEYS[key])
      throw new Error(`chave .env desconhecida: ${key}`)
    const value = quoteEnvValue(key, raw)
    const idx = lines.findIndex(l => l.startsWith(`${key}=`))
    if (idx >= 0)
      lines[idx] = `${key}=${value}`
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
    if (value === undefined)
      continue
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
  if (Object.keys(envEntries).length)
    upsertEnvFile(envEntries)
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
  const candidates: { label: string, path: string }[] = []
  if (config.reposRoot)
    candidates.push({ label: 'GITVIEW_REPOS_ROOT (.env/shell)', path: config.reposRoot })
  candidates.push({ label: 'padrão do setup', path: join(rootDir, 'data', 'repos') })

  for (const c of candidates) {
    // caminhos relativos são resolvidos a partir da raiz do projeto
    const abs = resolve(rootDir, c.path)
    if (existsSync(abs))
      return abs
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
