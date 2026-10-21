/**
 * Acesso HTTP à API do GitHub (REST + GraphQL + device flow) — sem depender
 * do gh CLI. Usado pelos coletores e pelo onboarding da UI.
 *
 * Token (ordem): `GITVIEW_GITHUB_TOKEN` (`.env`/shell — gravado pelo device
 * flow ou colado na UI) → `gh auth token` (ponte pra quem já tem o gh
 * autenticado).
 *
 * Device flow: precisa de um OAuth App ou **GitHub App** com "device flow"
 * habilitado; o client_id é público por design e fica no `.env`
 * (`GITVIEW_GITHUB_CLIENT_ID`, default do `.env.example`). GitHub App
 * (client_id "Iv…") é o recomendado: as permissões granulares do app
 * (Contents: read) tornam o token fisicamente read-only; OAuth App
 * ("Ov…"/hex) usa o escopo `repo`, que é read+write.
 */
import { spawnSync } from 'node:child_process'
import { loadConfig } from './config'

export interface GhAuth { token: string, via: 'token (.env)' | 'gh cli' }

export function getToken(): GhAuth | null {
  const envToken = loadConfig().githubToken
  if (envToken)
    return { token: envToken, via: 'token (.env)' }
  const r = spawnSync('gh', ['auth', 'token'], { encoding: 'utf-8' })
  const token = r.status === 0 ? r.stdout.trim() : ''
  return token ? { token, via: 'gh cli' } : null
}

export const NO_TOKEN_HINT = 'sem token do GitHub — conecte sua conta no setup (/setup → "Conectar com GitHub") ou rode "gh auth login"'

/**
 * Erro HTTP da API com status + janela de retry — permite backoff de 403/429
 * (rate limit primário/secundário) usando os próprios headers da API, em vez de
 * cair direto no fallback de cache (follow-up #11).
 */
export class GhHttpError extends Error {
  status: number
  retryAfterMs: number | null
  constructor(message: string, status: number, retryAfterMs: number | null) {
    super(message)
    this.name = 'GhHttpError'
    this.status = status
    this.retryAfterMs = retryAfterMs
  }
}

/** Retry-After (segundos) tem prioridade; senão x-ratelimit-reset (epoch s). Cap de 60s. */
export function retryAfterFromHeaders(headers: Headers): number | null {
  const ra = Number(headers.get('retry-after'))
  if (Number.isFinite(ra) && ra > 0)
    return Math.min(ra * 1000, 60_000)
  const reset = Number(headers.get('x-ratelimit-reset'))
  if (Number.isFinite(reset) && reset > 0)
    return Math.max(0, Math.min(reset * 1000 - Date.now(), 60_000))
  return null
}

export async function ghApi<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gitview',
    },
  })
  if (!res.ok)
    throw new GhHttpError(`GitHub API ${path}: HTTP ${res.status}`, res.status, retryAfterFromHeaders(res.headers))
  return res.json() as Promise<T>
}

/** pagina ?per_page=100 até acabar (teto de 10 páginas por segurança) */
export async function ghApiAll<T>(path: string, token: string): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= 10; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const items = await ghApi<T[]>(`${path}${sep}per_page=100&page=${page}`, token)
    out.push(...items)
    if (items.length < 100)
      return out
    // página cheia na última iteração: possível truncagem — avisa (nunca em silêncio)
    if (page === 10)
      console.warn(`  ! GitHub API ${path}: lista truncada em ${out.length} itens (teto de 10 páginas em ghApiAll)`)
  }
  return out
}

/** GraphQL v4 — throws com "HTTP <status>" em rede/4xx e "graphql: <msg>" p/ erros do body */
export async function ghGraphql<T>(query: string, vars: Record<string, unknown>, token: string): Promise<T> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'gitview',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables: vars }),
  })
  const json = await res.json().catch(() => ({}) as Record<string, unknown>)
  if (!res.ok) {
    const detail = typeof json.message === 'string' ? ` — ${json.message}` : ''
    throw new GhHttpError(`GitHub GraphQL: HTTP ${res.status}${detail}`, res.status, retryAfterFromHeaders(res.headers))
  }
  const errors = (json as { errors?: { message?: string }[] }).errors
  if (errors?.length)
    throw new Error(`graphql: ${String(errors[0].message ?? 'erro sem mensagem')}`)
  return (json as { data: T }).data
}

export function currentUser(token: string): Promise<{ login: string }> {
  return ghApi('/user', token)
}

export interface OrgEntry { login: string }
export interface RepoEntry { name: string, archived: boolean, pushed_at: string | null, private: boolean }

export function listOrgs(token: string): Promise<OrgEntry[]> {
  return ghApiAll<OrgEntry>('/user/orgs', token)
}

/** membros da org (requer token com read:org; falha → lista vazia) */
export function listOrgMembers(token: string, org: string): Promise<{ login: string, avatar_url: string }[]> {
  return ghApiAll<{ login: string, avatar_url: string }>(`/orgs/${encodeURIComponent(org)}/members`, token)
}

/** times da org + membros de cada um (requer read:org; falha → []) */
export async function listOrgTeams(token: string, org: string): Promise<{ slug: string, name: string, description: string | null, members: string[] }[]> {
  const teams = await ghApiAll<{ slug: string, name: string, description: string | null }>(`/orgs/${encodeURIComponent(org)}/teams`, token)
  const members = await Promise.all(
    teams.map(t =>
      ghApiAll<{ login: string }>(`/orgs/${encodeURIComponent(org)}/teams/${encodeURIComponent(t.slug)}/members`, token)
        .then(ms => ms.map(m => m.login))
        .catch(() => [] as string[]),
    ),
  )
  return teams.map((t, i) => ({ ...t, members: members[i] }))
}

export function listOrgRepos(token: string, org: string): Promise<RepoEntry[]> {
  return ghApiAll<RepoEntry>(`/orgs/${encodeURIComponent(org)}/repos?type=all`, token)
}

/** repos pessoais do usuário autenticado (dono + colaborador) */
export function listUserRepos(token: string): Promise<RepoEntry[]> {
  return ghApiAll<RepoEntry>('/user/repos?affiliation=owner,collaborator', token)
}

// ---------------------------------------------------------------------------
// device flow (OAuth App ou GitHub App com device flow — sem client secret)
// ---------------------------------------------------------------------------
export interface DeviceStart {
  deviceCode: string
  userCode: string
  verificationUri: string
  interval: number
}

export async function deviceStart(clientId: string): Promise<DeviceStart> {
  // GitHub App (client_id "Iv…") não aceita scope: o token herda as permissões
  // granulares do registro do app (ex.: Contents read-only). OAuth App pede
  // `repo read:org` (o `repo` clássico é read+write — endurecido no git via
  // denyPush nos clones gerenciados).
  const isGitHubApp = clientId.startsWith('Iv')
  const res = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(isGitHubApp ? { client_id: clientId } : { client_id: clientId, scope: 'repo read:org' }),
  })
  if (!res.ok)
    throw new Error(`device flow: HTTP ${res.status}`)
  const json = await res.json() as Record<string, unknown>
  if (!json.device_code)
    throw new Error(`device flow: ${String(json.error_description ?? json.error ?? 'resposta inesperada')}`)
  return {
    deviceCode: String(json.device_code),
    userCode: String(json.user_code),
    verificationUri: String(json.verification_uri),
    interval: Number(json.interval ?? 5),
  }
}

export type DevicePollResult
  = | { status: 'pending' | 'slow_down' | 'expired' | 'denied' }
    | { status: 'ok', token: string }

export async function devicePoll(clientId: string, deviceCode: string): Promise<DevicePollResult> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    }),
  })
  if (!res.ok)
    throw new Error(`device poll: HTTP ${res.status}`)
  const json = await res.json() as Record<string, unknown>
  if (json.access_token)
    return { status: 'ok', token: String(json.access_token) }
  switch (json.error) {
    case 'authorization_pending': return { status: 'pending' }
    case 'slow_down': return { status: 'slow_down' }
    case 'access_denied': return { status: 'denied' }
    default: return { status: 'expired' }
  }
}
