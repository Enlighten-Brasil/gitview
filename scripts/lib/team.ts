/**
 * Merge de aliases do time: config.authors/githubUsers/bots (versionado)
 * + devProfiles (config.local.json). Os coletores usam daqui pra que os
 * aliases cadastrados na UI de times já valham na coleta seguinte.
 */
import type { Config } from './config'

export interface ResolvedAliases {
  /** e-mail (lowercase) -> nome canônico */
  emailToCanonical: Map<string, string>
  /** login do GitHub (lowercase) -> nome canônico */
  loginToCanonical: Map<string, string>
}

export function resolveAliases(config: Config): ResolvedAliases {
  const emailToCanonical = new Map<string, string>()
  for (const [canonical, emails] of Object.entries(config.authors ?? {})) {
    for (const e of emails) emailToCanonical.set(e.toLowerCase(), canonical)
  }
  const loginToCanonical = new Map<string, string>()
  for (const [login, name] of Object.entries(config.githubUsers ?? {})) {
    loginToCanonical.set(login.toLowerCase(), name)
  }
  // perfis locais: mesma chave (nome canônico) ganha aliases extras.
  // Em conflito com o config versionado, o local sobrescreve (dono da máquina manda).
  for (const [canonical, profile] of Object.entries(config.devProfiles ?? {})) {
    for (const e of profile.emails ?? []) emailToCanonical.set(e.toLowerCase(), canonical)
    for (const l of profile.githubLogins ?? []) loginToCanonical.set(l.toLowerCase(), canonical)
  }
  return { emailToCanonical, loginToCanonical }
}

/** logins de bot do config (githubBots) — nomes exatos, lowercase. Padrões automáticos ficam em BOT_LOGIN_RE */
export function botLoginSet(config: Config): Set<string> {
  return new Set((config.githubBots ?? []).map(b => b.toLowerCase()))
}

/** padrão de login de bot do GitHub (dependabot[bot], renovate-bot, ...) — usado por todos os coletores */
export const BOT_LOGIN_RE = /(\[bot\]|-bot$|^dependabot)/i

/** nomes canônicos de bot no git (termina com [bot] ou está em config.bots) */
export function botAuthorNames(config: Config, authors: { name: string }[]): Set<string> {
  const extra = new Set((config.bots ?? []).map(b => b.toLowerCase()))
  return new Set(
    authors
      .filter(a => /\[bot\]$/i.test(a.name.trim()) || extra.has(a.name.toLowerCase()))
      .map(a => a.name),
  )
}
