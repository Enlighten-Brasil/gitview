/**
 * Time: loader do team.json (estático) + client dos endpoints dev (config/GitHub).
 * Salvar dispara recoleta leve (só team.json) via startCollect? Não — o apply
 * usa o coletor único /__team/apply implícito: a UI chama saveTeamConfig e
 * depois re-roda loadTeam(true) após o backend regenerar via /__collect leve.
 * Aqui: save → POST /__team/config; refresh → startCollect já existente (4 passos).
 */
import { ref } from 'vue'
import type { TeamData } from './types'

export const team = ref<TeamData | null>(null)
export const teamLoadError = ref<string | null>(null)

export async function loadTeam(force = false) {
  if (team.value && !force) return
  try {
    const res = await fetch(force ? `/data/team.json?t=${Date.now()}` : '/data/team.json')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    team.value = await res.json()
    teamLoadError.value = null
  }
  catch (err) {
    team.value = null
    teamLoadError.value = String((err as Error).message ?? err)
  }
}

// ---------------------------------------------------------------------------
// endpoints dev (Vite)
// ---------------------------------------------------------------------------
export interface TeamConfigPayload {
  devProfiles: Record<string, { title?: string, description?: string, emails?: string[], githubLogins?: string[] }>
  teams: { name: string, description?: string, color?: string, members: string[] }[]
}

export interface TeamConfigState extends TeamConfigPayload {
  fixed: { authors: string[], githubUsers: Record<string, string> }
  githubOrg: string | null
}

export interface GithubTeamData {
  org: string
  members: { login: string, avatar_url: string }[]
  teams: { slug: string, name: string, description: string | null, members: string[] }[]
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

export function fetchTeamConfig(): Promise<TeamConfigState> {
  return req<TeamConfigState>('/__team/config')
}

export function saveTeamConfig(payload: TeamConfigPayload): Promise<{ ok: true }> {
  return req<{ ok: true }>('/__team/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function fetchGithubTeam(): Promise<GithubTeamData> {
  return req<GithubTeamData>('/__team/github')
}
