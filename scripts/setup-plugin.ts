import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import type { Config, DevProfile, TeamConfig } from './lib/config'
import type { RepoInfo } from './lib/repos'
import { Buffer } from 'node:buffer'
/**
 * Plugin Vite (apenas dev): endpoints locais pro onboarding pela UI.
 *
 *  GET  /__setup/status                     auth, reposRoot atual, defaults
 *                                           (?refs=1: + productionRef/integrationRefs
 *                                           da config e o resolvido por repo —
 *                                           card "Refs dos repositórios")
 *  POST /__setup/refs                       { productionRef, integrationRefs } → .env
 *  POST /__auth/device                      inicia o device flow (requer client id)
 *  POST /__auth/device/poll                 { deviceCode } -> pending/ok (grava o token)
 *  POST /__auth/token                       { token } — PAT colado (valida antes de gravar)
 *  POST /__auth/logout                      limpa o token do .env
 *  GET  /__setup/orgs                       orgs do usuário autenticado
 *  GET  /__setup/repos?org=X                repos da org (ou pessoais com org=@user)
 *  GET  /__setup/apply?org=X&repos=a,b,c    SSE: clona os faltantes em data/repos
 *                                           (&dry=1 só simula; &remove=d,e apaga
 *                                           clones gerenciados) e grava o .env
 *  GET  /__clean[?repos=1]                  apaga banco + JSONs (com repos=1 apaga
 *                                           também os clones) — o "pnpm clean" da UI
 *
 * Mesmo modelo do collect-plugin: só existe no dev server; localhost apenas.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { cleanLocalData } from './lib/clean'
import { loadConfig, rootDir, saveConfig } from './lib/config'
import { currentUser, devicePoll, deviceStart, getToken, listOrgMembers, listOrgRepos, listOrgs, listOrgTeams, listUserRepos } from './lib/github'
import { displayRefName, resolveIntegRefsAsync, resolveProdRefAsync } from './lib/refs'
import { cloneBare, discoverRepos, MANAGED_REPOS_DIR, mapPool, resolveReposRootSafe } from './lib/repos'

const tsxCli = join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs')

/** roda um script dos coletores e captura a saída (sem SSE — usado no save do /teams) */
function runScript(script: string, args: string[] = [], timeoutMs = 45_000): Promise<{ code: number, out: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [tsxCli, script, ...args], { cwd: rootDir })
    let out = ''
    let done = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = (code: number) => {
      if (done)
        return
      done = true
      if (timer)
        clearTimeout(timer)
      resolvePromise({ code, out })
    }
    // JSON POST sem canal de progresso: um filho pendurado travaria o request
    timer = setTimeout(() => {
      child.kill()
      out += `\n! timeout de ${timeoutMs / 1000}s — ${script} interrompido`
      finish(1)
    }, timeoutMs)
    child.stdout.on('data', (c: Buffer) => out += c.toString('utf-8'))
    child.stderr.on('data', (c: Buffer) => out += c.toString('utf-8'))
    child.on('error', (err) => {
      out += String(err.message)
      finish(1)
    })
    child.on('close', code => finish(code ?? 1))
  })
}

/**
 * Depois de gravar team.local.json: regenera o team.json (nomes/cores/membros e
 * renamedFrom valem na hora — sidebar, chips e /teams/<nome>) e roda o check-data.
 * Falha NAÕ derruba o salvar (o config já está persistido); vira warning.
 * Aliases de identidade continuam precisando da recoleta (mexem no stats.json).
 */
async function refreshTeamData(): Promise<{ teamRefreshed: boolean, warnings: string[] }> {
  const warnings: string[] = []
  const team = await runScript('scripts/collect-team.ts')
  if (team.code !== 0) {
    const last = team.out.split(/\r?\n/).filter(l => l.trim()).pop() ?? `exit ${team.code}`
    return { teamRefreshed: false, warnings: [`team.json não regenerado (${last}) — rode pnpm collect:team`] }
  }
  const check = await runScript('scripts/check-data.ts')
  if (check.code !== 0)
    warnings.push(`check-data após salvar: ${check.out.split(/\r?\n/).filter(l => l.trim()).slice(0, 3).join(' | ')}`)
  return { teamRefreshed: true, warnings }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolvePromise) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}'))
      }
      catch {
        // corpo ilegível/inválido: null (e não {} — {} passaria o sanitize como "config vazia" e gravaria por cima)
        resolvePromise(null)
      }
    })
    req.on('error', () => resolvePromise(null))
  })
}

/** token resolvido ou resposta 401 já enviada (retorna null) */
function requireToken(res: ServerResponse): string | null {
  const auth = getToken()
  if (!auth) {
    json(res, 401, { error: 'não autenticado — conecte sua conta do GitHub' })
    return null
  }
  return auth.token
}

// ---------------------------------------------------------------------------
// sanitização do payload /__team/config
// ---------------------------------------------------------------------------
function strOrUndef(v: unknown, max = 200): string | undefined {
  if (typeof v !== 'string')
    return undefined
  const s = v.trim()
  return s ? s.slice(0, max) : undefined
}

function strList(v: unknown, max = 30): string[] | undefined {
  if (!Array.isArray(v))
    return undefined
  const out = [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean))]
  return out.length ? out.slice(0, max) : undefined
}

function sanitizeDevProfiles(input: unknown): Record<string, DevProfile> {
  if (input == null)
    return {}
  if (typeof input !== 'object' || Array.isArray(input))
    throw new Error('devProfiles deve ser um objeto { nome: perfil }')
  const out: Record<string, DevProfile> = {}
  for (const [name, raw] of Object.entries(input as Record<string, unknown>)) {
    // JSON.parse pode trazer '__proto__' como chave própria; atribuí-la ao out alteraria o protótipo
    if (name === '__proto__' || name === 'constructor' || name === 'prototype')
      continue
    const canonical = name.trim()
    if (!canonical)
      throw new Error('nome de dev vazio')
    if (typeof raw !== 'object' || raw == null)
      throw new Error(`perfil inválido: ${canonical}`)
    const p = raw as Record<string, unknown>
    const profile: DevProfile = {}
    const title = strOrUndef(p.title)
    const description = strOrUndef(p.description, 500)
    const emails = strList(p.emails)
    const githubLogins = strList(p.githubLogins)
    if (title)
      profile.title = title
    if (description)
      profile.description = description
    if (emails)
      profile.emails = emails.map(e => e.toLowerCase())
    if (githubLogins)
      profile.githubLogins = githubLogins
    out[canonical] = profile
  }
  return out
}

function sanitizeTeams(input: unknown): TeamConfig[] {
  if (input == null)
    return []
  if (!Array.isArray(input))
    throw new Error('teams deve ser uma lista')
  const seen = new Set<string>()
  return input.map((raw) => {
    if (typeof raw !== 'object' || raw == null)
      throw new Error('time inválido')
    const t = raw as Record<string, unknown>
    const name = strOrUndef(t.name, 80)
    if (!name)
      throw new Error('time sem nome')
    if (seen.has(name.toLowerCase()))
      throw new Error(`time duplicado: ${name}`)
    seen.add(name.toLowerCase())
    const team: TeamConfig = { name, members: strList(t.members, 100) ?? [] }
    const description = strOrUndef(t.description, 300)
    const color = strOrUndef(t.color, 20)
    if (description)
      team.description = description
    if (color && /^#[0-9a-f]{3,8}$/i.test(color))
      team.color = color
    // histórico de nomes (renames na UI) — descarta o nome atual e duplicados
    const renamedFrom = strList(t.renamedFrom, 20)?.filter(n => n.toLowerCase() !== name.toLowerCase())
    if (renamedFrom?.length)
      team.renamedFrom = renamedFrom
    return team
  })
}

// ---------------------------------------------------------------------------
// refs de produção/integração (card "Refs dos repositórios" em /settings)
// ---------------------------------------------------------------------------
interface RepoRefs {
  name: string
  /** produção resolvida (nome curto) — null só quando nada é resolvível (error) */
  production: string | null
  /** integração resolvida (filtrada por existência no repo); vazia é legítimo */
  integration: string[]
  /** GITVIEW_PRODUCTION_REF explícito não existe neste repo — a coleta cai na detecção automática */
  productionFallback: boolean
  error?: string
}

/**
 * Cache por processo da resolução: o hint spawna git por repo (~0,5s/repo em
 * Windows), então /__setup/status?refs=1 só recalcula quando reposRoot, o
 * conjunto de repos ou os valores configurados mudam (o save troca a chave).
 * Fetch nos clones durante a coleta só reflete no restart do dev server —
 * aceitável para um hint somente-leitura.
 */
let refsCache: { key: string, resolved: RepoRefs[] } | null = null

/**
 * Resolução async (#134): spawn streaming por repo — o event loop do dev
 * server fica livre durante a 1ª resolução (antes o spawnSync bloqueava ~6s).
 * Sequencial de propósito: preserva a ordem dos warns entre repos.
 */
async function resolveAllRefs(config: Config, reposRoot: string, repos: RepoInfo[]): Promise<RepoRefs[]> {
  const key = JSON.stringify([reposRoot, repos.map(r => r.name), config.productionRef ?? '', config.integrationRefs ?? []])
  if (refsCache?.key === key)
    return refsCache.resolved
  const explicit = displayRefName(config.productionRef?.trim() || '')
  const resolved: RepoRefs[] = []
  for (const r of repos) {
    try {
      // #141: o resolvedor devolve a forma resolvível (pode ser longa); o hint
      // de /settings é exibição — segue com nome curto via displayRefName
      const production = displayRefName(await resolveProdRefAsync(r.path, config.productionRef))
      resolved.push({
        name: r.name,
        production,
        integration: (await resolveIntegRefsAsync(r.path, config.integrationRefs)).map(displayRefName),
        productionFallback: !!explicit && explicit !== production,
      })
    }
    catch (err) {
      // repo sem ref de produção resolvível é erro no seam — vira linha com error, não 500
      resolved.push({ name: r.name, production: null, integration: [], productionFallback: false, error: String((err as Error).message ?? err) })
    }
  }
  refsCache = { key, resolved }
  return resolved
}

/** nome de ref aceitável no .env (sem aspa/quebra — quoteEnvValue já recusa); '' = limpar */
function sanitizeRef(v: unknown, field: string): string {
  if (typeof v !== 'string')
    throw new Error(`${field} deve ser string`)
  const s = v.trim()
  if (!s)
    return ''
  if (s.length > 200 || !/^\w[\w./-]*$/.test(s))
    throw new Error(`ref inválida em ${field}: "${s}" — use nomes de branch (ex.: main, release/1.2)`)
  return s
}

/** lista de refs: array JSON ou CSV; ausente/nulo preserva o valor atual (undefined) */
function sanitizeRefList(v: unknown, field: string): string[] | undefined {
  if (v === undefined || v === null)
    return undefined
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(',') : null
  if (!raw)
    throw new Error(`${field} deve ser uma lista (ou CSV)`)
  return [...new Set(raw.map((x, i) => sanitizeRef(x, `${field}[${i}]`)).filter(Boolean))]
}

/** produção: string (vazio = auto) ou undefined (campo ausente = não mexe) */
function sanitizeRefOpt(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null)
    return undefined
  return sanitizeRef(v, field)
}

let applying = false

export function setupPlugin(): Plugin {
  return {
    name: 'gitview-setup',
    apply: 'serve',
    configureServer(server) {
      // status geral do ambiente (?refs=1: + refs configuradas e resolvidas por repo)
      server.middlewares.use('/__setup/status', async (req, res) => {
        try {
          const config = loadConfig()
          const reposRoot = resolveReposRootSafe(config)
          const repos = reposRoot ? discoverRepos(reposRoot) : []
          // o hint por repo spawna git (~0,5s/repo): só com ?refs=1, com cache por
          // processo — o status base (guard/wizard/poll de auth) continua barato
          const wantRefs = new URL(req.url ?? '', 'http://localhost').searchParams.get('refs') === '1'
          const auth = getToken()
          let login: string | null = null
          if (auth) {
            try {
              login = (await currentUser(auth.token)).login
            }
            catch {
              login = null // token inválido/expirado — UI trata como não autenticado
            }
          }
          json(res, 200, {
            auth: auth && login ? { login, via: auth.via } : null,
            oauthConfigured: !!config.githubClientId,
            reposRoot,
            repos: repos.map(r => r.name),
            hasData: existsSync(join(rootDir, 'public', 'data', 'stats.json')),
            defaultOrg: config.githubOrg ?? null,
            defaultRepos: config.defaultRepos ?? [],
            productionRef: config.productionRef ?? null,
            integrationRefs: config.integrationRefs ?? [],
            ...(wantRefs ? { resolvedRefs: reposRoot ? await resolveAllRefs(config, reposRoot, repos) : [] } : {}),
          })
        }
        catch (err) {
          json(res, 500, { error: String((err as Error).message ?? err) })
        }
      })

      // refs de produção/integração do card "Refs dos repositórios" (/settings):
      // grava GITVIEW_PRODUCTION_REF / GITVIEW_INTEGRATION_REFS no .env via
      // saveConfig (linha a linha, preserva comentários). Sem validação contra
      // os repos: ref inexistente cai no fallback por repo com warn na coleta
      // (comportamento do seam scripts/lib/refs.ts). A leitura do resolvido é
      // o GET /__setup/status?refs=1 acima. Prefixo novo dentro de /__setup —
      // não colide com /status, /orgs, /repos nem /apply (connect casa por prefixo).
      server.middlewares.use('/__setup/refs', async (req, res) => {
        if (req.method !== 'POST') {
          json(res, 405, { error: 'use GET /__setup/status?refs=1 para ler as refs' })
          return
        }
        const body = await readBody(req)
        if (!body) {
          json(res, 400, { error: 'corpo JSON inválido' })
          return
        }
        try {
          const productionRef = sanitizeRefOpt(body.productionRef, 'productionRef')
          const integrationRefs = sanitizeRefList(body.integrationRefs, 'integrationRefs')
          const patch: Partial<Config> = {}
          if (productionRef !== undefined)
            patch.productionRef = productionRef
          if (integrationRefs !== undefined)
            patch.integrationRefs = integrationRefs
          saveConfig(patch)
          // devolve a config efetiva pós-save ('' vira null/default — o cliente ressincroniza os inputs)
          const saved = loadConfig()
          json(res, 200, {
            ok: true,
            productionRef: saved.productionRef ?? null,
            integrationRefs: saved.integrationRefs ?? [],
          })
        }
        catch (err) {
          json(res, 400, { error: String((err as Error).message ?? err) })
        }
      })

      // device flow: poll (grava o token no .env ao concluir)
      // ATENÇÃO: registrado ANTES do '/__auth/device' — o connect casa por
      // prefixo, então '/__auth/device' engoliria '/__auth/device/poll'.
      server.middlewares.use('/__auth/device/poll', async (req, res) => {
        const clientId = loadConfig().githubClientId
        if (!clientId) {
          json(res, 409, { error: 'oauth_not_configured' })
          return
        }
        const body = await readBody(req)
        if (!body) {
          json(res, 400, { error: 'corpo JSON inválido' })
          return
        }
        const deviceCode = String(body.deviceCode ?? '')
        if (!deviceCode) {
          json(res, 400, { error: 'deviceCode ausente' })
          return
        }
        try {
          const result = await devicePoll(clientId, deviceCode)
          if (result.status === 'ok') {
            saveConfig({ githubToken: result.token })
            const login = (await currentUser(result.token)).login
            json(res, 200, { status: 'ok', login })
            return
          }
          json(res, 200, result)
        }
        catch (err) {
          json(res, 500, { error: String((err as Error).message ?? err) })
        }
      })

      // device flow: início
      server.middlewares.use('/__auth/device', async (req, res) => {
        const clientId = loadConfig().githubClientId
        if (!clientId) {
          json(res, 409, { error: 'oauth_not_configured' })
          return
        }
        try {
          json(res, 200, await deviceStart(clientId))
        }
        catch (err) {
          json(res, 500, { error: String((err as Error).message ?? err) })
        }
      })

      // PAT colado na UI: valida na API antes de gravar no .env
      server.middlewares.use('/__auth/token', async (req, res) => {
        const body = await readBody(req)
        if (!body) {
          json(res, 400, { error: 'corpo JSON inválido' })
          return
        }
        const token = String(body.token ?? '').trim()
        if (!token) {
          json(res, 400, { error: 'token ausente' })
          return
        }
        try {
          const user = await currentUser(token)
          saveConfig({ githubToken: token })
          json(res, 200, { login: user.login })
        }
        catch (err) {
          json(res, 401, { error: `token inválido ou sem acesso — ${(err as Error).message}` })
        }
      })

      // desconectar: limpa a chave do .env (se o gh CLI estiver logado, ele
      // continua servindo de ponte — a UI reflete isso no próximo status)
      server.middlewares.use('/__auth/logout', async (_req, res) => {
        saveConfig({ githubToken: '' })
        json(res, 200, { ok: true })
      })

      // orgs do usuário (+ entrada pseudo pra repos pessoais)
      server.middlewares.use('/__setup/orgs', async (_req, res) => {
        const token = requireToken(res)
        if (!token)
          return
        try {
          const [user, orgs] = await Promise.all([currentUser(token), listOrgs(token)])
          json(res, 200, [{ login: user.login, personal: true }, ...orgs])
        }
        catch (err) {
          json(res, 500, { error: String((err as Error).message ?? err) })
        }
      })

      // repos de uma org (ou pessoais)
      server.middlewares.use('/__setup/repos', async (req, res) => {
        const token = requireToken(res)
        if (!token)
          return
        const org = new URL(req.url ?? '', 'http://localhost').searchParams.get('org') ?? ''
        if (!org) {
          json(res, 400, { error: 'org ausente' })
          return
        }
        try {
          const full = org === '@user'
            ? await listUserRepos(token)
            : await listOrgRepos(token, org)
          // enxuga o payload: a API devolve o objeto repo inteiro (~100 campos)
          const repos = full.map(r => ({ name: r.name, archived: r.archived, pushed_at: r.pushed_at, private: r.private }))
          json(res, 200, repos.sort((a, b) => (b.pushed_at ?? '').localeCompare(a.pushed_at ?? '')))
        }
        catch (err) {
          json(res, 500, { error: String((err as Error).message ?? err) })
        }
      })

      // apply: clona os repos escolhidos (SSE) e aponta reposRoot pra data/repos
      server.middlewares.use('/__setup/apply', (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })
        const send = (event: string, data: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        }

        if (applying) {
          send('busy', {})
          res.end()
          return
        }

        const params = new URL(req.url ?? '', 'http://localhost').searchParams
        const org = params.get('org') ?? ''
        const repos = (params.get('repos') ?? '').split(',').map(s => s.trim()).filter(Boolean)
        const dry = params.get('dry') === '1'
        // remoção explícita de clones gerenciados (fluxo "gerenciar repositórios" —
        // o cliente só manda os nomes que o usuário desmarcou de propósito)
        const remove = (params.get('remove') ?? '').split(',').map(s => s.trim()).filter(n => /^[\w.-]+$/.test(n))
        if (!org || !repos.length) {
          send('error', { message: 'org/repos ausentes' })
          res.end()
          return
        }
        applying = true

        ;(async () => {
          const token = getToken()?.token
          mkdirSync(MANAGED_REPOS_DIR, { recursive: true })
          for (const name of remove) {
            const dir = join(MANAGED_REPOS_DIR, name)
            if (!existsSync(dir))
              continue
            await rm(dir, { recursive: true, force: true })
            send('log', { line: `− ${name}: clone removido do disco` })
          }
          const existing = new Set(discoverRepos(MANAGED_REPOS_DIR).map(r => r.name))
          const missing = repos.filter(name => !existing.has(name))
          send('log', { line: `${repos.length} selecionados: ${missing.length} a clonar, ${repos.length - missing.length} já existem` })
          if (dry) {
            for (const name of missing) send('log', { line: `[dry-run] clonaria ${org}/${name}` })
            send('done', { dry: true, cloned: 0, skipped: repos.length - missing.length })
            return
          }
          if (missing.length && !token) {
            send('error', { message: 'sem token do GitHub — conecte sua conta no passo 1 antes de clonar' })
            return
          }
          let failures = 0
          await mapPool(missing, 4, async (name) => {
            const t0 = Date.now()
            const err = await cloneBare(`${org}/${name}`, join(MANAGED_REPOS_DIR, name), token)
            if (err) {
              failures++
              send('log', { line: `✗ ${name}: ${err.split('\n')[0]}` })
            }
            else {
              send('log', { line: `✓ ${name} clonado (${((Date.now() - t0) / 1000).toFixed(0)}s)` })
            }
          })
          saveConfig({ reposRoot: 'data/repos' })
          send('log', { line: '.env gravado (GITVIEW_REPOS_ROOT = data/repos)' })
          if (failures) {
            send('error', { message: `${failures} repo(s) falharam ao clonar` })
            return
          }
          send('done', { cloned: missing.length, skipped: repos.length - missing.length })
        })()
          .catch(err => send('error', { message: String((err as Error).message ?? err) }))
          .finally(() => {
            applying = false
            res.end()
          })
      })

      // ---------------------------------------------------------------------
      // time: perfis de devs e times (team.local.json → team.json)
      // ---------------------------------------------------------------------

      // membros + times da org no GitHub (sugestões pra importar)
      server.middlewares.use('/__team/github', async (_req, res) => {
        const token = requireToken(res)
        if (!token)
          return
        const org = loadConfig().githubOrg
        if (!org) {
          json(res, 409, { error: 'githubOrg não configurada' })
          return
        }
        try {
          // falhas por parte (ex.: token sem read:org → teams vazio) não derrubam o resto
          const warnings: string[] = []
          const members = await listOrgMembers(token, org).catch((err: unknown) => {
            warnings.push(`membros: ${(err as Error).message}`)
            return []
          })
          const teams = await listOrgTeams(token, org).catch((err: unknown) => {
            warnings.push(`times: ${(err as Error).message} (o token precisa da permissão read:org na org)`)
            return []
          })
          json(res, 200, { org, members, teams, warnings })
        }
        catch (err) {
          json(res, 500, { error: String((err as Error).message ?? err) })
        }
      })

      // lê perfis/times locais (team.local.json)
      server.middlewares.use('/__team/config', async (req, res) => {
        if (req.method === 'POST') {
          const body = await readBody(req)
          if (!body) {
            json(res, 400, { error: 'corpo JSON inválido' })
            return
          }
          try {
            const devProfiles = sanitizeDevProfiles(body.devProfiles)
            const teams = sanitizeTeams(body.teams)
            saveConfig({ devProfiles, teams })
            // o config salvo vale na hora p/ chips/sidebar/dashboards de time:
            // regenera o team.json (aliases ainda precisam da recoleta — stats.json).
            // skipRefresh: o cliente vai recoletar em seguida ("salvar + recoletar")
            // e a recoleta já regenera o team.json — pula o duplo (follow-up #12)
            const refresh = body.skipRefresh === true
              ? { teamRefreshed: false, warnings: [] }
              : await refreshTeamData()
            json(res, 200, {
              ok: true,
              devProfiles: Object.keys(devProfiles).length,
              teams: teams.length,
              teamRefreshed: refresh.teamRefreshed,
              warnings: refresh.warnings,
            })
          }
          catch (err) {
            json(res, 400, { error: String((err as Error).message ?? err) })
          }
          return
        }
        try {
          const config = loadConfig()
          json(res, 200, {
            devProfiles: config.devProfiles ?? {},
            teams: config.teams ?? [],
            githubOrg: config.githubOrg ?? null,
          })
        }
        catch (err) {
          // team.local.json corrompida: responde erro em vez de hanguear a requisição
          json(res, 500, { error: String((err as Error).message ?? err) })
        }
      })

      // limpeza local: apaga banco + JSONs (e clones com ?repos=1) sem recoletar.
      // Mesma lib do `pnpm clean`. O gate de primeira execução leva de volta ao wizard.
      server.middlewares.use('/__clean', async (req, res) => {
        if (applying) {
          json(res, 409, { error: 'setup em andamento — aguarde terminar' })
          return
        }
        const repos = new URL(req.url ?? '', 'http://localhost').searchParams.get('repos') === '1'
        applying = true
        try {
          const removed = cleanLocalData(repos)
          json(res, 200, { removed })
        }
        catch (err) {
          json(res, 500, { error: String((err as Error).message ?? err) })
        }
        finally {
          applying = false
        }
      })
    },
  }
}
