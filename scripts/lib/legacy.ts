/**
 * Migração única e idempotente do formato antigo de config:
 * config.json + config.local.json → `.env` + `team.local.json`.
 *
 * Disparada por loadConfig(). O gatilho é a existência do config.local.json
 * (máquina); depois de migrado ele é renomeado para .migrated e a função
 * vira no-op. O config.json versionado é removido do git no mesmo release —
 * quem for puxar depois e ainda o usa deve rodar a migração antes do pull
 * (ver README) ou remapear os aliases na tela /team.
 */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { DevProfile, TeamConfig } from './config'
import { rootDir, teamConfigPath, upsertEnvFile } from './config'

let attempted = false

export function migrateLegacyConfig(): void {
  if (attempted) return
  attempted = true
  const localPath = join(rootDir, 'config.local.json')
  if (!existsSync(localPath)) return
  try {
    migrate(localPath)
  }
  catch (err) {
    console.warn(`! migração do config legado falhou: ${(err as Error).message} (nada perdido — roda de novo na próxima execução)`)
  }
}

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  }
  catch {
    return {}
  }
}

function migrate(localPath: string): void {
  const shared = readJson(join(rootDir, 'config.json'))
  const local = readJson(localPath)

  // 1) .env: machine + segredos (shell ainda vence — upsert não apaga nada do shell)
  const envEntries: Record<string, string> = {}
  const setEnv = (key: string, value: unknown) => {
    const v = typeof value === 'string' ? value.trim() : ''
    if (v && !process.env[key]?.trim()) envEntries[key] = v
  }
  const csv = (value: unknown) => Array.isArray(value) ? (value as string[]).join(',') : ''
  setEnv('GITVIEW_GITHUB_TOKEN', local.githubToken)
  setEnv('GITVIEW_REPOS_ROOT', local.reposRoot)
  setEnv('GITVIEW_GITHUB_ORG', shared.githubOrg)
  setEnv('GITVIEW_GITHUB_CLIENT_ID', shared.oauthClientId)
  setEnv('GITVIEW_DEFAULT_REPOS', csv(shared.defaultRepos))
  setEnv('GITVIEW_EXCLUDE', csv(shared.exclude))
  if (Object.keys(envEntries).length) upsertEnvFile(envEntries)

  // 2) team.local.json: aliases do config.json + perfis/times do config.local.json
  const profiles: Record<string, DevProfile> = {}
  const safeKey = (name: string) => name !== '__proto__' && name !== 'constructor' && name !== 'prototype'
  const profileFor = (canonical: string): DevProfile => {
    const key = canonical.trim()
    if (!key || !safeKey(key)) return {}
    return (profiles[key] ??= {})
  }
  const push = (list: string[] | undefined, value: string | undefined) => {
    const v = (value ?? '').trim()
    if (v && list && !list.includes(v)) list.push(v)
  }
  for (const [canonical, emails] of Object.entries((shared.authors ?? {}) as Record<string, string[]>)) {
    for (const email of emails ?? []) push((profileFor(canonical).emails ??= []), email)
  }
  for (const [login, canonical] of Object.entries((shared.githubUsers ?? {}) as Record<string, string>)) {
    push((profileFor(String(canonical)).githubLogins ??= []), login)
  }
  for (const [canonical, p] of Object.entries((local.devProfiles ?? {}) as Record<string, DevProfile>)) {
    const target = profileFor(canonical)
    if (p.title) target.title = p.title
    if (p.description) target.description = p.description
    for (const email of p.emails ?? []) push((target.emails ??= []), email)
    for (const login of p.githubLogins ?? []) push((target.githubLogins ??= []), login)
  }
  // remove perfis que ficaram sem nenhum dado (nomes só de login viram aliases)
  for (const [name, p] of Object.entries(profiles)) {
    if (!p.title && !p.description && !p.emails?.length && !p.githubLogins?.length) delete profiles[name]
  }

  const existing = existsSync(teamConfigPath)
    ? JSON.parse(readFileSync(teamConfigPath, 'utf-8')) as { devProfiles?: Record<string, DevProfile> }
    : null
  if (existing?.devProfiles) {
    // team.local.json já existia (migração parcial): funde os aliases legados sem duplicar
    for (const [name, p] of Object.entries(profiles)) {
      const cur = (existing.devProfiles[name] ??= {})
      cur.emails = [...new Set([...(cur.emails ?? []), ...(p.emails ?? [])])]
      cur.githubLogins = [...new Set([...(cur.githubLogins ?? []), ...(p.githubLogins ?? [])])]
    }
    Object.assign(existing, { devProfiles: existing.devProfiles })
    writeFileSync(teamConfigPath, `${JSON.stringify(existing, null, 2)}\n`)
  }
  else {
    const teamFile: { devProfiles: Record<string, DevProfile>, teams: TeamConfig[], bots?: string[], githubBots?: string[] } = {
      devProfiles: profiles,
      teams: (local.teams ?? []) as TeamConfig[],
    }
    if (Array.isArray(shared.bots) && shared.bots.length) teamFile.bots = shared.bots as string[]
    if (Array.isArray(shared.githubBots) && shared.githubBots.length) teamFile.githubBots = shared.githubBots as string[]
    writeFileSync(teamConfigPath, `${JSON.stringify(teamFile, null, 2)}\n`)
  }

  // 3) tira o gatilho do caminho (histórico preservado, gitignored)
  renameSync(localPath, `${localPath}.migrated`)
  console.log('✓ config migrado para .env + team.local.json (config.local.json → config.local.json.migrated)')
}
