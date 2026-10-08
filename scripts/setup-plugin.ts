/**
 * Plugin Vite (apenas dev): endpoints locais pro onboarding pela UI.
 *
 *  GET  /__setup/status                     auth, reposRoot atual, defaults
 *  POST /__auth/device                      inicia o device flow (requer oauthClientId)
 *  POST /__auth/device/poll                 { deviceCode } -> pending/ok (grava o token)
 *  GET  /__setup/orgs                       orgs do usuário autenticado
 *  GET  /__setup/repos?org=X                repos da org (ou pessoais com org=@user)
 *  GET  /__setup/apply?org=X&repos=a,b,c    SSE: clona os faltantes em data/repos
 *                                           (&dry=1 só simula; &remove=d,e apaga
 *                                           clones gerenciados) e grava config.local.json
 *  GET  /__clean[?repos=1]                  apaga banco + JSONs (com repos=1 apaga
 *                                           também os clones) — o "pnpm clean" da UI
 *
 * Mesmo modelo do collect-plugin: só existe no dev server; localhost apenas.
 */
import { existsSync, mkdirSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { loadConfig, rootDir, saveLocalConfig } from './lib/config'
import type { DevProfile, TeamConfig } from './lib/config'
import { cleanLocalData } from './lib/clean'
import { currentUser, devicePoll, deviceStart, getToken, listOrgMembers, listOrgs, listOrgRepos, listOrgTeams, listUserRepos } from './lib/github'
import { cloneBare, discoverRepos, MANAGED_REPOS_DIR, mapPool, resolveReposRootSafe } from './lib/repos'

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
  if (typeof v !== 'string') return undefined
  const s = v.trim()
  return s ? s.slice(0, max) : undefined
}

function strList(v: unknown, max = 30): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = [...new Set(v.filter((x): x is string => typeof x === 'string').map(x => x.trim()).filter(Boolean))]
  return out.length ? out.slice(0, max) : undefined
}

function sanitizeDevProfiles(input: unknown): Record<string, DevProfile> {
  if (input == null) return {}
  if (typeof input !== 'object' || Array.isArray(input)) throw new Error('devProfiles deve ser um objeto { nome: perfil }')
  const out: Record<string, DevProfile> = {}
  for (const [name, raw] of Object.entries(input as Record<string, unknown>)) {
    // JSON.parse pode trazer '__proto__' como chave própria; atribuí-la ao out alteraria o protótipo
    if (name === '__proto__' || name === 'constructor' || name === 'prototype') continue
    const canonical = name.trim()
    if (!canonical) throw new Error('nome de dev vazio')
    if (typeof raw !== 'object' || raw == null) throw new Error(`perfil inválido: ${canonical}`)
    const p = raw as Record<string, unknown>
    const profile: DevProfile = {}
    const title = strOrUndef(p.title)
    const description = strOrUndef(p.description, 500)
    const emails = strList(p.emails)
    const githubLogins = strList(p.githubLogins)
    if (title) profile.title = title
    if (description) profile.description = description
    if (emails) profile.emails = emails.map(e => e.toLowerCase())
    if (githubLogins) profile.githubLogins = githubLogins
    out[canonical] = profile
  }
  return out
}

function sanitizeTeams(input: unknown): TeamConfig[] {
  if (input == null) return []
  if (!Array.isArray(input)) throw new Error('teams deve ser uma lista')
  const seen = new Set<string>()
  return input.map((raw) => {
    if (typeof raw !== 'object' || raw == null) throw new Error('time inválido')
    const t = raw as Record<string, unknown>
    const name = strOrUndef(t.name, 80)
    if (!name) throw new Error('time sem nome')
    if (seen.has(name.toLowerCase())) throw new Error(`time duplicado: ${name}`)
    seen.add(name.toLowerCase())
    const team: TeamConfig = { name, members: strList(t.members, 100) ?? [] }
    const description = strOrUndef(t.description, 300)
    const color = strOrUndef(t.color, 20)
    if (description) team.description = description
    if (color && /^#[0-9a-f]{3,8}$/i.test(color)) team.color = color
    return team
  })
}

let applying = false

export function setupPlugin(): Plugin {
  return {
    name: 'gitview-setup',
    apply: 'serve',
    configureServer(server) {
      // status geral do ambiente
      server.middlewares.use('/__setup/status', async (_req, res) => {
        try {
          const config = loadConfig()
          const reposRoot = resolveReposRootSafe(config)
          const repos = reposRoot ? discoverRepos(reposRoot, config.exclude ?? []) : []
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
            oauthConfigured: !!config.oauthClientId,
            reposRoot,
            repos: repos.map(r => r.name),
            hasData: existsSync(join(rootDir, 'public', 'data', 'stats.json')),
            defaultOrg: config.githubOrg ?? null,
            defaultRepos: config.defaultRepos ?? [],
          })
        }
        catch (err) {
          json(res, 500, { error: String((err as Error).message ?? err) })
        }
      })

      // device flow: poll (grava o token no config.local.json ao concluir)
      // ATENÇÃO: registrado ANTES do '/__auth/device' — o connect casa por
      // prefixo, então '/__auth/device' engoliria '/__auth/device/poll'.
      server.middlewares.use('/__auth/device/poll', async (req, res) => {
        const clientId = loadConfig().oauthClientId
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
            saveLocalConfig({ githubToken: result.token })
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
        const clientId = loadConfig().oauthClientId
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

      // orgs do usuário (+ entrada pseudo pra repos pessoais)
      server.middlewares.use('/__setup/orgs', async (_req, res) => {
        const token = requireToken(res)
        if (!token) return
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
        if (!token) return
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
          saveLocalConfig({ reposRoot: 'data/repos' })
          send('log', { line: 'config.local.json gravado (reposRoot = data/repos)' })
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
      // time: perfis de devs e times (config.local.json → team.json)
      // ---------------------------------------------------------------------

      // membros + times da org no GitHub (sugestões pra importar)
      server.middlewares.use('/__team/github', async (_req, res) => {
        const token = requireToken(res)
        if (!token) return
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

      // lê perfis/times locais + resumo do config versionado (aliases fixos)
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
            saveLocalConfig({ devProfiles, teams })
            json(res, 200, { ok: true, devProfiles: Object.keys(devProfiles).length, teams: teams.length })
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
            // aliases fixos do config.json (só leitura — edição é no repo)
            fixed: {
              authors: Object.keys(config.authors ?? {}),
              githubUsers: config.githubUsers ?? {},
            },
            githubOrg: config.githubOrg ?? null,
          })
        }
        catch (err) {
          // config.local.json corrompida: responde erro em vez de hanguear a requisição
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
