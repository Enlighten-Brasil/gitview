/**
 * Cliente dos endpoints de onboarding (apenas dev — middleware do Vite,
 * não existe no build estático). Cobre auth (device flow/PAT/gh) e o setup
 * de repositórios (listar orgs/repos, clonar com progresso SSE).
 */
import { getJson, postJson } from './api'
import { useSseProgress } from './sse'

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

export function startDeviceFlow(): Promise<DeviceFlowStart> {
  return getJson('/__auth/device')
}

export function pollDeviceFlow(deviceCode: string, signal?: AbortSignal): Promise<DeviceFlowPoll> {
  // permite abortar o poll em voo quando o fluxo é cancelado/desmontado
  return postJson<DeviceFlowPoll>('/__auth/device/poll', { deviceCode }, { signal })
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
const applyProgress = useSseProgress('/__setup/apply', {
  busyMessage: 'já existe um setup em andamento',
  disconnectMessage: 'conexão com o dev server caiu durante o setup',
})

export const setupApplying = applyProgress.running
export const setupLog = applyProgress.log
export const setupError = applyProgress.error
export const setupDone = applyProgress.done

export function startSetupApply(org: string, repos: string[], opts: { dry?: boolean, remove?: string[] } = {}) {
  const params: Record<string, string> = { org, repos: repos.join(',') }
  if (opts.dry)
    params.dry = '1'
  if (opts.remove?.length)
    params.remove = opts.remove.join(',')
  applyProgress.start(params)
}
