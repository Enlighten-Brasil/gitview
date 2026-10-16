import type { TeamData } from './types'
/**
 * Time: loader do team.json (estático) + client dos endpoints dev-only:
 * GET/POST /__team/config (perfis/times em team.local.json) e
 * GET /__team/github (membros + times da org).
 * Recoleta após salvar usa o /__collect existente (4 passos) — não há
 * endpoint parcial só de team.json.
 */
import { ref } from 'vue'

export const team = ref<TeamData | null>(null)
export const teamLoadError = ref<string | null>(null)

export async function loadTeam(force = false) {
  if (team.value && !force)
    return
  try {
    const res = await fetch(force ? `${import.meta.env.BASE_URL}data/team.json?t=${Date.now()}` : `${import.meta.env.BASE_URL}data/team.json`)
    if (!res.ok)
      throw new Error(`HTTP ${res.status}`)
    team.value = await res.json()
    teamLoadError.value = null
  }
  catch (err) {
    team.value = null
    teamLoadError.value = String((err as Error).message ?? err)
  }
}

// ---------------------------------------------------------------------------
// helpers de exibição (avatares de iniciais — sem foto, tudo offline)
// ---------------------------------------------------------------------------
const AVATAR_BGS = [
  'bg-violet-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-indigo-500',
  'bg-cyan-500',
]

/** iniciais (1ª + última palavra); nomes de uma peça usam as 2 primeiras letras */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length)
    return '?'
  if (parts.length === 1)
    return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** classe de fundo estável por nome (hash simples) */
export function avatarBgClass(name: string): string {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AVATAR_BGS[h % AVATAR_BGS.length]
}

// ---------------------------------------------------------------------------
// endpoints dev (Vite)
// ---------------------------------------------------------------------------
/**
 * Paleta canônica de cor de time — única fonte (popover do TeamCard + default
 * atribuído pelo editor em /teams; a cor sobrevive só no team.local.json)
 */
export const TEAM_PALETTE = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

export interface TeamConfigPayload {
  devProfiles: Record<string, { title?: string, description?: string, emails?: string[], githubLogins?: string[] }>
  teams: { name: string, description?: string, color?: string, members: string[], renamedFrom?: string[] }[]
}

/** rascunho de time no editor (campos sempre presentes, vazio = string '') */
export interface TeamDraft {
  /**
   * id estável de sessão (v-for key) — times são removíveis; índice como key
   * faz o estado local do card ("confirmar remoção" armado, popover aberto)
   * herdar o time errado depois de um splice
   */
  cid: string
  name: string
  description: string
  color: string
  members: string[]
  /** nomes antigos vindos do último save (renomeado mantém /teams/<antigo> vivo) */
  renamedFrom: string[]
  /** nome como está salvo (comparado no payload p/ detectar rename) */
  savedName: string
}

/** métricas agregadas de um time (fontes: stats.json + github.json) */
export interface TeamMetrics {
  devs: number
  commits: number
  prs: number
  lastCommit: string | null
}

export interface TeamConfigState extends TeamConfigPayload {
  githubOrg: string | null
}

export interface GithubTeamData {
  org: string
  members: { login: string, avatar_url: string }[]
  teams: { slug: string, name: string, description: string | null, members: string[] }[]
  /** falhas parciais na API (ex.: token sem read:org → times vazio) */
  warnings?: string[]
}

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(data.error ?? `HTTP ${res.status}`)
  return data as T
}

export interface SaveTeamResult {
  ok: true
  teamRefreshed?: boolean
  warnings?: string[]
}

export function fetchTeamConfig(): Promise<TeamConfigState> {
  return req<TeamConfigState>('/__team/config')
}

export function saveTeamConfig(payload: TeamConfigPayload, opts?: { skipRefresh?: boolean }): Promise<SaveTeamResult> {
  return req<SaveTeamResult>('/__team/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // skipRefresh: o chamador vai recoletar em seguida — o POST pula a
    // regeneração do team.json (collect-team + check-data rodariam 2×)
    body: JSON.stringify(opts?.skipRefresh ? { ...payload, skipRefresh: true } : payload),
  })
}

export function fetchGithubTeam(): Promise<GithubTeamData> {
  return req<GithubTeamData>('/__team/github')
}
