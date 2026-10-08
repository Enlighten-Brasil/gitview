/**
 * Setup interativo de repositórios.
 *
 * Lista os repos da org do GitHub (config.githubOrg) via `gh`, deixa o dev
 * escolher quais entram no dashboard e clona os faltantes em data/repos/
 * (clone bare, sem working tree — os coletores só leem refs/objetos).
 * Ao final grava config.local.json com reposRoot apontando pra data/repos.
 *
 * Uso:
 *   pnpm setup            wizard interativo
 *   pnpm setup -- --yes   sem perguntas: todos os repos não arquivados
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'
import * as readline from 'node:readline/promises'
import { loadConfig, saveLocalConfig } from './lib/config'
import { getToken } from './lib/github'
import { cloneBare, discoverRepos, MANAGED_REPOS_DIR, mapPool, resolveReposRootSafe } from './lib/repos'

const YES = process.argv.includes('--yes') || process.argv.includes('-y')

interface GhRepo { name: string; isArchived: boolean; pushedAt: string }

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// gh instalado + autenticado
// ---------------------------------------------------------------------------
function checkGh(): void {
  const v = spawnSync('gh', ['--version'], { encoding: 'utf-8' })
  if (v.error || v.status !== 0) {
    fail('GitHub CLI (gh) não encontrado. Instale em https://cli.github.com e rode "gh auth login".')
  }
  const auth = spawnSync('gh', ['auth', 'status'], { encoding: 'utf-8' })
  if (auth.status !== 0) fail('gh não está autenticado. Rode "gh auth login" e tente de novo.')
}

// ---------------------------------------------------------------------------
// lista de repos da org
// ---------------------------------------------------------------------------
function listOrgRepos(org: string): GhRepo[] {
  const r = spawnSync('gh', [
    'repo', 'list', org,
    '--limit', '500',
    '--json', 'name,isArchived,pushedAt',
  ], { encoding: 'utf-8', maxBuffer: 16 * 1024 * 1024 })
  if (r.error || r.status !== 0) {
    fail(`não consegui listar os repos de ${org}: ${(r.stderr || '').trim() || r.error}`)
  }
  const repos = JSON.parse(r.stdout) as GhRepo[]
  return repos.sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''))
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
      if (from < 1 || to > max || from > to) return null
      for (let i = from; i <= to; i++) picked.add(i - 1)
      continue
    }
    if (!/^\d+$/.test(token)) return null
    const n = Number(token)
    if (n < 1 || n > max) return null
    picked.add(n - 1)
  }
  return picked.size ? [...picked].sort((a, b) => a - b) : null
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
checkGh()
const config = loadConfig()
let org = config.githubOrg
if (!org) {
  if (YES) fail('defina "githubOrg" no config.json (ex.: "minha-org").')
  const rl = readline.createInterface({ input, output })
  org = (await rl.question('Org do GitHub para listar os repos: ')).trim()
  rl.close()
  if (!org) fail('org não informada.')
}

// já existe uma fonte de repos funcionando?
const current = resolveReposRootSafe(config)
const currentRepos = current ? discoverRepos(current) : []
const alreadyManaged = current === MANAGED_REPOS_DIR
if (current && currentRepos.length && !alreadyManaged) {
  console.log(`Fonte de repos já configurada: ${current} (${currentRepos.length} repos)`)
  if (YES) {
    console.log('Nada a fazer. Para migrar pros clones gerenciados, remova reposRoot do config.local.json e rode novamente.')
    process.exit(0)
  }
  const rl = readline.createInterface({ input, output })
  const answer = await rl.question('Migrar pros clones gerenciados em data/repos? [y/N] ')
  rl.close()
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log('Ok, mantido como está.')
    process.exit(0)
  }
}

console.log(`\nListando repos de ${org}...`)
const ghRepos = listOrgRepos(org)
if (!ghRepos.length) fail(`nenhum repo encontrado em ${org} — confira o acesso da sua conta.`)

mkdirSync(MANAGED_REPOS_DIR, { recursive: true })
const cloned = new Set(discoverRepos(MANAGED_REPOS_DIR).map(r => r.name))

console.log('')
ghRepos.forEach((r, i) => {
  const marks = [cloned.has(r.name) ? 'clonado' : '', r.isArchived ? 'arquivado' : ''].filter(Boolean).join(', ')
  console.log(`  ${String(i + 1).padStart(3)}. ${r.name}${marks ? ` (${marks})` : ''}`)
})

// seleção: Enter/--yes = defaultRepos do config (fallback: todos não arquivados)
const defaultNames = (config.defaultRepos ?? []).map(n => n.toLowerCase())
const defaultIdx = ghRepos.map((_, i) => i)
  .filter(i => !ghRepos[i].isArchived && (!defaultNames.length || defaultNames.includes(ghRepos[i].name.toLowerCase())))
const notInOrg = (config.defaultRepos ?? []).filter(n => !ghRepos.some(r => r.name.toLowerCase() === n.toLowerCase()))
if (notInOrg.length) console.warn(`! defaultRepos fora da org (ignorados): ${notInOrg.join(', ')}`)

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
    selected = ghRepos.map((_, i) => i).filter(i => !ghRepos[i].isArchived)
  }
  else {
    selected = parseSelection(text, ghRepos.length)
    if (!selected) fail('seleção inválida — rode de novo e use números/ranges dentro da lista.')
  }
}

const chosen = selected.map(i => ghRepos[i])
const missing = chosen.filter(r => !cloned.has(r.name))
console.log(`\nSelecionados: ${chosen.length} (${missing.length} a clonar, ${chosen.length - missing.length} já clonados)`)

// clone bare em paralelo (autenticado com o token do gh/device flow)
const token = getToken()?.token
let failures = 0
await mapPool(missing, 4, async (repo) => {
  const dest = join(MANAGED_REPOS_DIR, repo.name)
  const t0 = Date.now()
  const err = await cloneBare(`${org}/${repo.name}`, dest, token)
  if (err) {
    failures++
    console.error(`✗ ${repo.name}: ${err.split('\n')[0]}`)
  }
  else {
    console.log(`✓ ${repo.name} clonado (${((Date.now() - t0) / 1000).toFixed(0)}s)`)
  }
})
if (failures) console.warn(`\n! ${failures} repo(s) falharam — rode o setup de novo pra tentar outra vez.`)

// credential helper do gh pros fetches futuros (collect faz git fetch nos clones)
spawnSync('gh', ['auth', 'setup-git'], { encoding: 'utf-8' })

// config.local.json: merge raso + reposRoot gerenciado (relativo = portátil)
saveLocalConfig({ reposRoot: 'data/repos' })

console.log(`\n✓ config.local.json gravado com reposRoot = data/repos`)
console.log('\nPróximos passos:')
console.log('  pnpm collect   # primeira coleta (completa, leva alguns minutos)')
console.log('  pnpm dev       # http://localhost:5173')
