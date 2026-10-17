import type { TeamData } from './types'
/**
 * Time: loader do team.json (estático) + client dos endpoints dev-only:
 * GET/POST /__team/config (perfis/times em team.local.json) e
 * GET /__team/github (membros + times da org).
 * Recoleta após salvar usa o /__collect existente (4 passos) — não há
 * endpoint parcial só de team.json.
 */
import { getJson, postJson } from './api'
import { defineLoader } from './loader'

// loader do team.json — em falha o time some (a UI volta pro skeleton)
const teamLoader = defineLoader<TeamData>('team.json', { onErrorValue: null })
export const team = teamLoader.data
export const teamLoadError = teamLoader.error
export const loadTeam = teamLoader.load

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

/** métricas vazias — fallback do metricsByCid quando o cid ainda não foi computado */
export const EMPTY_TEAM_METRICS: TeamMetrics = { devs: 0, commits: 0, prs: 0, lastCommit: null }

/** opção do combobox de adicionar membro (hint marca quem já está em outro time) */
export interface MemberAddItem {
  label: string
  value: string
  hint?: string
}

/** rascunho de perfil de dev no editor (listas como string separada por vírgula) */
export interface ProfileDraft {
  title: string
  description: string
  emails: string
  githubLogins: string
}

/** entrada de devProfiles do payload (ou equivalente) */
export interface ProfileDraftSource {
  title?: string | null
  description?: string | null
  emails?: string[]
  githubLogins?: string[]
}

/** fonte do mapeamento de time: entrada do payload OU TeamInfo do team.json */
export interface TeamDraftSource {
  name: string
  description?: string | null
  color?: string | null
  members: string[]
  renamedFrom?: string[]
}

export function toProfileDraft(p?: ProfileDraftSource): ProfileDraft {
  return {
    title: p?.title ?? '',
    description: p?.description ?? '',
    emails: (p?.emails ?? []).join(', '),
    githubLogins: (p?.githubLogins ?? []).join(', '),
  }
}

/**
 * Mapeamento ÚNICO TeamConfig/team.json → TeamDraft (issue #40): o mapping
 * triplicado no editor era ponto de divergência quando um campo novo entrava.
 * O `savedName` nasce como o nome atual — renomes só acumulam no toTeamEntry.
 */
export function toTeamDraft(t: TeamDraftSource): TeamDraft {
  return {
    cid: crypto.randomUUID(),
    name: t.name,
    description: t.description ?? '',
    color: t.color ?? '',
    members: [...t.members],
    renamedFrom: [...(t.renamedFrom ?? [])],
    savedName: t.name,
  }
}

/** entrada de payload DE um draft específico (alinhado por construção, não por nome) */
export function toTeamEntry(t: TeamDraft): TeamConfigPayload['teams'][number] {
  const name = t.name.trim()
  // rename desde o último save → o nome antigo entra no histórico
  // (comparado por cid, não por índice: remoções não desalinhiam os times)
  const history = [...new Set(
    t.savedName && t.savedName !== name ? [...t.renamedFrom, t.savedName] : t.renamedFrom,
  )].filter(n => n !== name)
  return {
    name,
    ...(t.description.trim() ? { description: t.description.trim() } : {}),
    ...(t.color.trim() ? { color: t.color.trim() } : {}),
    members: t.members,
    ...(history.length ? { renamedFrom: history } : {}),
  }
}

/** lista separada por vírgula → array (trim + sem vazios) */
export function splitList(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

/**
 * splitList sem duplicatas (comparação por caixa-baixa, mantendo a 1ª grafia) —
 *  digitar o mesmo e-mail/login duas vezes gerava :key duplicado no v-for dos
 *  badges e duplicata persistida no team.local.json (issue #30)
 */
export function dedupeList(s: string): string[] {
  const seen = new Set<string>()
  return splitList(s).filter((x) => {
    const k = x.toLowerCase()
    if (seen.has(k))
      return false
    seen.add(k)
    return true
  })
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

export interface SaveTeamResult {
  ok: true
  teamRefreshed?: boolean
  warnings?: string[]
}

export function fetchTeamConfig(): Promise<TeamConfigState> {
  return getJson<TeamConfigState>('/__team/config')
}

export function saveTeamConfig(payload: TeamConfigPayload, opts?: { skipRefresh?: boolean }): Promise<SaveTeamResult> {
  // skipRefresh: o chamador vai recoletar em seguida — o POST pula a
  // regeneração do team.json (collect-team + check-data rodariam 2×)
  return postJson<SaveTeamResult>('/__team/config', opts?.skipRefresh ? { ...payload, skipRefresh: true } : payload)
}

export function fetchGithubTeam(): Promise<GithubTeamData> {
  return getJson<GithubTeamData>('/__team/github')
}
