import type { RepoEntry } from './lib/github'
/**
 * Setup interativo de repositórios (terminal).
 *
 * Lista os repos da org do GitHub (GITVIEW_GITHUB_ORG) via API, deixa o dev
 * escolher quais entram no dashboard e clona os faltantes em data/repos/
 * (clone bare, sem working tree — os coletores só leem refs/objetos).
 * Ao final grava GITVIEW_REPOS_ROOT no .env.
 *
 * Auth: token do .env (GITVIEW_GITHUB_TOKEN) com fallback pro `gh auth token`
 * — o gh CLI NÃO é obrigatório.
 *
 * Uso:
 *   pnpm setup            wizard interativo
 *   pnpm setup -- --yes   sem perguntas: repos padrão (ou todos não arquivados)
 */
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import process, { stdin as input, stdout as output } from 'node:process'
import * as readline from 'node:readline/promises'
import { loadConfig, saveConfig } from './lib/config'
import { getToken, ghApiAll, NO_TOKEN_HINT } from './lib/github'
import { cloneBare, discoverRepos, MANAGED_REPOS_DIR, mapPool, resolveReposRootSafe } from './lib/repos'

const YES = process.argv.includes('--yes') || process.argv.includes('-y')

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// lista de repos da org (API REST, autenticada com o token da config)
// ---------------------------------------------------------------------------
async function listOrgRepos(org: string, token: string): Promise<RepoEntry[]> {
  try {
    return await ghApiAll<RepoEntry>(`/orgs/${encodeURIComponent(org)}/repos?type=all`, token)
  }
  catch (err) {
    fail(`não consegui listar os repos de ${org}: ${(err as Error).message}`)
  }
}

// ---------------------------------------------------------------------------
// seleção: "1,3,5-8" -> índices 0-based (null se inválido)
// ---------------------------------------------------------------------------
function parseSelection(text: string, max: number): number[] | null {
  const picked = new Set<number>()
  for (const token of text.split(/[,\s]+/).filter(Boolean)) {
    const range = token.match(/^(\d+)-(\d+)$/)
    if (range) {
      const from = Number(range[1])
      const to = Number(range[2])
      if (from < 1 || to > max || from > to)
        return null
      for (let i = from; i <= to; i++) picked.add(i - 1)
      continue
    }
    if (!/^\d+$/.test(token))
      return null
    const n = Number(token)
    if (n < 1 || n > max)
      return null
    picked.add(n - 1)
  }
  return picked.size ? [...picked].sort((a, b) => a - b) : null
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const auth = getToken()
if (!auth)
  fail(`${NO_TOKEN_HINT}.`)

const config = loadConfig()
let org = config.githubOrg
if (!org) {
  if (YES)
    fail('defina GITVIEW_GITHUB_ORG no .env (ex.: "minha-org") ou rode o wizard sem --yes.')
  const rl = readline.createInterface({ input, output })
  org = (await rl.question('Org do GitHub para listar os repos: ')).trim()
  rl.close()
  if (!org)
    fail('org não informada.')
}

// já existe uma fonte de repos funcionando?
const current = resolveReposRootSafe(config)
const currentRepos = current ? discoverRepos(current) : []
const alreadyManaged = current === MANAGED_REPOS_DIR
if (current && currentRepos.length && !alreadyManaged) {
  console.log(`Fonte de repos já configurada: ${current} (${currentRepos.length} repos)`)
  if (YES) {
    console.log('Nada a fazer. Para migrar pros clones gerenciados, limpe GITVIEW_REPOS_ROOT no .env e rode novamente.')
    process.exit(0)
  }
  const rl = readline.createInterface({ input, output })
  const answer = await rl.question('Migrar pros clones gerenciados em data/repos? [y/N] ')
  rl.close()
  if (!/^y(?:es)?$/i.test(answer.trim())) {
    console.log('Ok, mantido como está.')
    process.exit(0)
  }
}

console.log(`\nListando repos de ${org}...`)
const ghRepos = (await listOrgRepos(org, auth.token))
  .sort((a, b) => (b.pushed_at ?? '').localeCompare(a.pushed_at ?? ''))
if (!ghRepos.length)
  fail(`nenhum repo encontrado em ${org} — confira o acesso da sua conta.`)

mkdirSync(MANAGED_REPOS_DIR, { recursive: true })
const cloned = new Set(discoverRepos(MANAGED_REPOS_DIR).map(r => r.name))

console.log('')
ghRepos.forEach((r, i) => {
  const marks = [cloned.has(r.name) ? 'clonado' : '', r.archived ? 'arquivado' : ''].filter(Boolean).join(', ')
  console.log(`  ${String(i + 1).padStart(3)}. ${r.name}${marks ? ` (${marks})` : ''}`)
})

// seleção: Enter/--yes = defaultRepos do .env (fallback: todos não arquivados)
const defaultNames = (config.defaultRepos ?? []).map(n => n.toLowerCase())
const defaultIdx = ghRepos.map((_, i) => i)
  .filter(i => !ghRepos[i].archived && (!defaultNames.length || defaultNames.includes(ghRepos[i].name.toLowerCase())))
const notInOrg = (config.defaultRepos ?? []).filter(n => !ghRepos.some(r => r.name.toLowerCase() === n.toLowerCase()))
if (notInOrg.length)
  console.warn(`! defaultRepos fora da org (ignorados): ${notInOrg.join(', ')}`)

let selected: number[] | null
if (YES) {
  selected = defaultIdx
}
else {
  const rl = readline.createInterface({ input, output })
  console.log('\nQuais repos entram no dashboard?')
  const answer = await rl.question('Números e ranges (ex.: 1,2,5-8), "all" = todos não arquivados, Enter = padrão do time: ')
  rl.close()
  const text = answer.trim()
  if (!text) {
    selected = defaultIdx
  }
  else if (/^all$/i.test(text)) {
    selected = ghRepos.map((_, i) => i).filter(i => !ghRepos[i].archived)
  }
  else {
    selected = parseSelection(text, ghRepos.length)
    if (!selected)
      fail('seleção inválida — rode de novo e use números/ranges dentro da lista.')
  }
}

const chosen = selected.map(i => ghRepos[i])
const missing = chosen.filter(r => !cloned.has(r.name))
console.log(`\nSelecionados: ${chosen.length} (${missing.length} a clonar, ${chosen.length - missing.length} já clonados)`)

// clone bare em paralelo (autenticado com o token da config; fetch usa o mesmo token)
let failures = 0
await mapPool(missing, 4, async (repo) => {
  const dest = join(MANAGED_REPOS_DIR, repo.name)
  const t0 = Date.now()
  const err = await cloneBare(`${org}/${repo.name}`, dest, auth.token)
  if (err) {
    failures++
    console.error(`✗ ${repo.name}: ${err.split('\n')[0]}`)
  }
  else {
    console.log(`✓ ${repo.name} clonado (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
})
if (failures)
  console.warn(`\n! ${failures} repo(s) falharam — rode o setup de novo pra tentar outra vez.`)

// .env: reposRoot gerenciado (relativo = portátil)
saveConfig({ reposRoot: 'data/repos' })

console.log('\n✓ GITVIEW_REPOS_ROOT = data/repos gravado no .env')
console.log('\nPróximos passos:')
console.log('  pnpm collect   # primeira coleta (completa, leva alguns minutos)')
console.log('  pnpm dev       # http://localhost:5173')
