/**
 * Cliente dos endpoints de onboarding (apenas dev — middleware do Vite,
 * não existe no build estático). Cobre auth (device flow/PAT/gh) e o setup
 * de repositórios (listar orgs/repos, clonar com progresso SSE).
 */
import { ref } from 'vue'

export interface SetupStatus {
  auth: { login: string, via: string } | null
  oauthConfigured: boolean
  reposRoot: string | null
  repos: string[]
  hasData: boolean
  defaultOrg: string | null
  defaultRepos: string[]
}

export interface OrgEntry { login: string, personal?: boolean }
export interface RepoEntry { name: string, archived: boolean, pushed_at: string | null, private: boolean }

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const body = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(body.error ?? `HTTP ${res.status}`)
  return body as T
}

export function fetchSetupStatus(): Promise<SetupStatus> {
  return getJson('/__setup/status')
}

export function fetchOrgs(): Promise<OrgEntry[]> {
  return getJson('/__setup/orgs')
}

export function fetchRepos(org: string): Promise<RepoEntry[]> {
  return getJson(`/__setup/repos?org=${encodeURIComponent(org)}`)
}

// ---------------------------------------------------------------------------
// device flow
// ---------------------------------------------------------------------------
export interface DeviceFlowStart {
  deviceCode: string
  userCode: string
  verificationUri: string
  interval: number
}

export type DeviceFlowPoll
  = | { status: 'pending' | 'slow_down' | 'expired' | 'denied' }
    | { status: 'ok', login: string }

// ---------------------------------------------------------------------------
// PAT colado + desconexão
// ---------------------------------------------------------------------------
export function submitGithubToken(token: string): Promise<{ login: string }> {
  return postJson<{ login: string }>('/__auth/token', { token })
}

export function githubLogout(): Promise<{ ok: true }> {
  return postJson<{ ok: true }>('/__auth/logout', {})
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
  return data as T
}

export function startDeviceFlow(): Promise<DeviceFlowStart> {
  return getJson('/__auth/device')
}

export async function pollDeviceFlow(deviceCode: string, signal?: AbortSignal): Promise<DeviceFlowPoll> {
  const res = await fetch('/__auth/device/poll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceCode }),
    // permite abortar o poll em voo quando o fluxo é cancelado/desmontado
    signal,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(body.error ?? `HTTP ${res.status}`)
  return body as DeviceFlowPoll
}

// ---------------------------------------------------------------------------
// limpeza local (o "pnpm clean" da UI): apaga banco + JSONs; com repos, os clones
// ---------------------------------------------------------------------------
export async function cleanLocalData(repos: boolean): Promise<string[]> {
  const { removed } = await getJson<{ removed: string[] }>(`/__clean${repos ? '?repos=1' : ''}`)
  return removed
}

// ---------------------------------------------------------------------------
// apply (clone) com progresso via SSE
// ---------------------------------------------------------------------------
export const setupApplying = ref(false)
export const setupLog = ref<string[]>([])
export const setupError = ref<string | null>(null)
export const setupDone = ref(false)

const MAX_LOG_LINES = 300

export function startSetupApply(org: string, repos: string[], opts: { dry?: boolean, remove?: string[] } = {}) {
  if (setupApplying.value)
    return
  setupApplying.value = true
  setupLog.value = []
  setupError.value = null
  setupDone.value = false

  const params = new URLSearchParams({ org, repos: repos.join(',') })
  if (opts.dry)
    params.set('dry', '1')
  if (opts.remove?.length)
    params.set('remove', opts.remove.join(','))
  const es = new EventSource(`/__setup/apply?${params}`)

  es.addEventListener('log', (e) => {
    setupLog.value.push(JSON.parse((e as MessageEvent).data).line)
    if (setupLog.value.length > MAX_LOG_LINES) {
      setupLog.value.splice(0, setupLog.value.length - MAX_LOG_LINES)
    }
  })
  es.addEventListener('busy', () => {
    setupError.value = 'já existe um setup em andamento'
    es.close()
    setupApplying.value = false
  })
  es.addEventListener('done', () => {
    es.close()
    setupApplying.value = false
    setupDone.value = true
  })
  es.addEventListener('error', (e) => {
    const data = (e as MessageEvent).data
    if (data) {
      setupError.value = JSON.parse(data).message
    }
    else if (!setupDone.value && setupApplying.value) {
      setupError.value = 'conexão com o dev server caiu durante o setup'
    }
    es.close()
    setupApplying.value = false
  })
}
