/**
 * Coletor de perfis do time → public/data/team.json.
 *
 * Junta:
 * - perfis/times do team.local.json (devProfiles/teams — dados locais de gestão)
 * - aliases detectados nos dados coletados: autores do stats.json (nome+emails)
 *   e logins do github.json (PRs/reviews)
 *
 * O merge de aliases efetivo (config + perfis) também é usado pelos coletores
 * principais via `resolveAliases` em lib/team.ts — o stats.json e o github.json
 * já nascem com os nomes canônicos certos.
 *
 * Roda por último na sequência: lê stats.json e github.json (quando existem)
 * pra calcular os candidatos não mapeados.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './lib/config'
import { BOT_LOGIN_RE, botAuthorNames, botLoginSet, resolveAliases } from './lib/team'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const config = loadConfig()
const { emailToCanonical, loginToCanonical } = resolveAliases(config)
const botLogins = botLoginSet(config)

const outDir = join(root, 'public', 'data')
mkdirSync(outDir, { recursive: true })

// ---------------------------------------------------------------------------
// dados já coletados (podem não existir ainda — primeiro setup)
// ---------------------------------------------------------------------------
interface StatsJson { authors?: { name: string, emails: string[], bot: boolean }[] }
interface GithubJson { users?: Record<string, { name: string, bot: boolean }>, prs?: { author: string, reviews: { author: string }[] }[] }

function readJson<T>(file: string): T | null {
  const path = join(outDir, file)
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf-8')) as T : null
}

const stats = readJson<StatsJson>('stats.json')
const github = readJson<GithubJson>('github.json')

// bots sinalizados na coleta do GitHub (githubBots + regex) — fonte autoritativa aqui
const ghBotLogins = new Set(Object.entries(github?.users ?? {}).filter(([, u]) => u.bot).map(([l]) => l.toLowerCase()))

// ---------------------------------------------------------------------------
// universo de devs: perfis + autores/logins canônicos vistos nos dados
// ---------------------------------------------------------------------------
const profiles = config.devProfiles ?? {}
const profileByLower = new Map(Object.entries(profiles).map(([k, v]) => [k.toLowerCase(), v]))
const canonicalNames = new Set<string>(Object.keys(profiles))

for (const a of stats?.authors ?? []) canonicalNames.add(a.name)
// 'ghost' = autor de PR apagado (collect-github) — não é dev
for (const [login, u] of Object.entries(github?.users ?? {})) {
  if (login.toLowerCase() !== 'ghost')
    canonicalNames.add(u.name)
}

const botAuthors = stats ? botAuthorNames(config, stats.authors ?? []) : new Set<string>()

// times por dev (chave = nome canônico exato; match case-insensitive pra ser tolerante)
const teams = (config.teams ?? []).map((t) => {
  // Array.isArray: team.local.json editado à mão pode trazer renamedFrom como
  // string — [...new Set('abc')] viraria 1 entrada POR CARACTERE no team.json.
  // Itens não-string dentro da lista também são descartados (o write-side
  // strList já filtra; aqui é a porta do read — follow-up #12). A comparação
  // com o nome atual normaliza NFC: um renamedFrom NFD (macOS) igual ao nome
  // atual não deve sobreviver no JSON.
  const currentNorm = t.name.normalize('NFC').toLowerCase()
  const renamedFrom = [...new Set(
    (Array.isArray(t.renamedFrom) ? t.renamedFrom : []).filter((n): n is string => typeof n === 'string'),
  )].filter(n => n.normalize('NFC').toLowerCase() !== currentNorm)
  return {
    name: t.name,
    description: t.description ?? null,
    color: t.color ?? null,
    members: t.members,
    ...(renamedFrom.length ? { renamedFrom } : {}),
  }
})
const teamsByDev = new Map<string, string[]>()
const canonicalByLower = new Map([...canonicalNames].map(n => [n.toLowerCase(), n]))
for (const t of teams) {
  for (const member of t.members) {
    const canonical = canonicalByLower.get(member.toLowerCase()) ?? member
    if (!teamsByDev.has(canonical))
      teamsByDev.set(canonical, [])
    teamsByDev.get(canonical)!.push(t.name)
    canonicalNames.add(canonical)
  }
}

// e-mails: config (authors + perfis) + detectados no git
const emailsByDev = new Map<string, Set<string>>()
function addEmail(dev: string, email: string) {
  if (!emailsByDev.has(dev))
    emailsByDev.set(dev, new Set())
  emailsByDev.get(dev)!.add(email)
}
for (const [email, canonical] of emailToCanonical) addEmail(canonical, email)
for (const a of stats?.authors ?? []) {
  for (const e of a.emails) {
    // se o e-mail tem alias próprio apontando pra outro canônico, respeita o alias
    addEmail(emailToCanonical.get(e.toLowerCase()) ?? a.name, e)
  }
}

// logins: config (githubUsers + perfis) + detectados no github.json
const loginsByDev = new Map<string, Set<string>>()
function addLogin(dev: string, login: string) {
  if (!loginsByDev.has(dev))
    loginsByDev.set(dev, new Set())
  const set = loginsByDev.get(dev)!
  // dedupe por case: a chave do mapa de aliases é lowercase e a API traz o case
  // real — sem isso 'jsmithdev' + 'jsmithDev' viravam 2 logins do dev
  for (const existing of set) {
    if (existing.toLowerCase() !== login.toLowerCase())
      continue
    if (existing === existing.toLowerCase() && login !== existing) {
      set.delete(existing)
      set.add(login)
    }
    return
  }
  set.add(login)
}
for (const [login, canonical] of loginToCanonical) addLogin(canonical, login)
for (const [login, u] of Object.entries(github?.users ?? {})) {
  if (login.toLowerCase() === 'ghost')
    continue
  addLogin(loginToCanonical.get(login.toLowerCase()) ?? u.name, login)
}

const devs = [...canonicalNames]
  .map(name => ({
    name,
    title: profileByLower.get(name.toLowerCase())?.title ?? null,
    description: profileByLower.get(name.toLowerCase())?.description ?? null,
    emails: [...(emailsByDev.get(name) ?? [])].sort(),
    githubLogins: [...(loginsByDev.get(name) ?? [])].sort(),
    teams: (teamsByDev.get(name) ?? []).sort(),
    bot: botAuthors.has(name)
      || [...(loginsByDev.get(name) ?? [])].some((l) => {
        const k = l.toLowerCase()
        return botLogins.has(k) || ghBotLogins.has(k) || BOT_LOGIN_RE.test(l)
      }),
  }))
  .sort((a, b) => a.name.localeCompare(b.name))

// ---------------------------------------------------------------------------
// candidatos: identidades nos dados sem alias/perfil cadastrado
// ---------------------------------------------------------------------------
const candidates: { kind: 'author' | 'login', id: string, emails?: string[], prs?: number }[] = []

for (const a of stats?.authors ?? []) {
  // autor sem nenhum e-mail aliasado e sem perfil próprio → nome cru do git
  const aliased = a.emails.some(e => emailToCanonical.has(e.toLowerCase()))
  if (!aliased && !profileByLower.has(a.name.toLowerCase()) && !botAuthors.has(a.name)) {
    candidates.push({ kind: 'author', id: a.name, emails: a.emails })
  }
}

const prCountByLogin = new Map<string, number>()
for (const pr of github?.prs ?? []) {
  prCountByLogin.set(pr.author, (prCountByLogin.get(pr.author) ?? 0) + 1)
  for (const r of pr.reviews) {
    if (r.author)
      prCountByLogin.set(r.author, (prCountByLogin.get(r.author) ?? 0) + 1)
  }
}
for (const login of Object.keys(github?.users ?? {})) {
  const k = login.toLowerCase()
  if (k === 'ghost' || loginToCanonical.has(k) || botLogins.has(k) || ghBotLogins.has(k) || BOT_LOGIN_RE.test(login))
    continue
  candidates.push({ kind: 'login', id: login, prs: prCountByLogin.get(login) ?? 0 })
}

candidates.sort((a, b) => a.id.localeCompare(b.id))

writeFileSync(join(outDir, 'team.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  devs,
  teams,
  candidates,
}))

console.log(`✓ team.json: ${devs.length} devs (${Object.keys(profiles).length} com perfil), ${teams.length} times, ${candidates.length} candidatos a mapear`)
