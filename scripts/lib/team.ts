/**
 * Merge de aliases do time: devProfiles do team.local.json (editados na UI
 * /teams). Os coletores usam daqui pra que os aliases cadastrados já valham
 * na coleta seguinte.
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
  const loginToCanonical = new Map<string, string>()
  for (const [canonical, profile] of Object.entries(config.devProfiles ?? {})) {
    for (const e of profile.emails ?? []) emailToCanonical.set(e.toLowerCase(), canonical)
    for (const l of profile.githubLogins ?? []) loginToCanonical.set(l.toLowerCase(), canonical)
  }
  return { emailToCanonical, loginToCanonical }
}

/** bots do GitHub reconhecidos sem config — extras via team.local.json#githubBots */
export const DEFAULT_GITHUB_BOTS = [
  'dependabot',
  'copilot-pull-request-reviewer',
  'copilot-swe-agent',
  'cursor',
  'github-code-quality',
]

/** logins de bot do config (default + githubBots) — nomes exatos, lowercase. Padrões automáticos ficam em BOT_LOGIN_RE */
export function botLoginSet(config: Config): Set<string> {
  return new Set([...DEFAULT_GITHUB_BOTS, ...(config.githubBots ?? [])].map(b => b.toLowerCase()))
}

/** padrão de login de bot do GitHub (dependabot[bot], renovate-bot, ...) — usado por todos os coletores */
export const BOT_LOGIN_RE = /(\[bot\]|-bot$|^dependabot)/i

/**
 * Padrão de NOME DE BRANCH de bot (issue #123) — BOT_LOGIN_RE/DEFAULT_GITHUB_BOTS
 * casam logins do GitHub, não nomes de ref ('renovate/x' não casa com nenhum
 * deles). Extras exatos via GITVIEW_BOT_BRANCHES (botBranchSet).
 */
export const BOT_BRANCH_RE = /^(dependabot|renovate)\//

/** nomes exatos de branch de bot da config (GITVIEW_BOT_BRANCHES) — lowercase, padrão do botLoginSet */
export function botBranchSet(config: Config): Set<string> {
  return new Set((config.botBranches ?? []).map(b => b.toLowerCase()))
}

/** nomes canônicos de bot no git (termina com [bot] ou está em config.bots) */
export function botAuthorNames(config: Config, authors: { name: string }[]): Set<string> {
  const extra = new Set((config.bots ?? []).map(b => b.toLowerCase()))
  return new Set(
    authors
      .filter(a => /\[bot\]$/i.test(a.name.trim()) || extra.has(a.name.toLowerCase()))
      .map(a => a.name),
  )
}
