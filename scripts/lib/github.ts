/**
 * Acesso à API do GitHub sem depender do gh CLI — usado pelo onboarding da UI.
 *
 * Token (ordem): config.local.json `githubToken` (gravado pelo device flow)
 * → `gh auth token` (ponte pra quem já tem o gh autenticado).
 *
 * Device flow: precisa de um OAuth App ou **GitHub App** com "device flow"
 * habilitado; o client_id é público por design e fica em config.json
 * (`oauthClientId`). GitHub App (client_id "Iv…") é o recomendado: as
 * permissões granulares do app (Contents: read) tornam o token fisicamente
 * read-only; OAuth App ("Ov…"/hex) usa o escopo `repo`, que é read+write.
 */
import { spawnSync } from 'node:child_process'
import { loadConfig } from './config'

export interface GhAuth { token: string; via: 'device flow' | 'gh cli' }

export function getToken(): GhAuth | null {
  const local = loadConfig().githubToken
  if (local) return { token: local, via: 'device flow' }
  const r = spawnSync('gh', ['auth', 'token'], { encoding: 'utf-8' })
  const token = r.status === 0 ? r.stdout.trim() : ''
  return token ? { token, via: 'gh cli' } : null
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
  if (!res.ok) throw new Error(`GitHub API ${path}: HTTP ${res.status}`)
  return res.json() as Promise<T>
}

/** pagina ?per_page=100 até acabar (teto de 10 páginas por segurança) */
export async function ghApiAll<T>(path: string, token: string): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page <= 10; page++) {
    const sep = path.includes('?') ? '&' : '?'
    const items = await ghApi<T[]>(`${path}${sep}per_page=100&page=${page}`, token)
    out.push(...items)
    if (items.length < 100) break
  }
  return out
}

export function currentUser(token: string): Promise<{ login: string }> {
  return ghApi('/user', token)
}

export interface OrgEntry { login: string }
export interface RepoEntry { name: string; archived: boolean; pushed_at: string | null; private: boolean }

export function listOrgs(token: string): Promise<OrgEntry[]> {
  return ghApiAll<OrgEntry>('/user/orgs', token)
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
  if (!res.ok) throw new Error(`device flow: HTTP ${res.status}`)
  const json = await res.json() as Record<string, unknown>
  if (!json.device_code) throw new Error(`device flow: ${String(json.error_description ?? json.error ?? 'resposta inesperada')}`)
  return {
    deviceCode: String(json.device_code),
    userCode: String(json.user_code),
    verificationUri: String(json.verification_uri),
    interval: Number(json.interval ?? 5),
  }
}

export type DevicePollResult =
  | { status: 'pending' | 'slow_down' | 'expired' | 'denied' }
  | { status: 'ok'; token: string }

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
  if (!res.ok) throw new Error(`device poll: HTTP ${res.status}`)
  const json = await res.json() as Record<string, unknown>
  if (json.access_token) return { status: 'ok', token: String(json.access_token) }
  switch (json.error) {
    case 'authorization_pending': return { status: 'pending' }
    case 'slow_down': return { status: 'slow_down' }
    case 'access_denied': return { status: 'denied' }
    default: return { status: 'expired' }
  }
}
