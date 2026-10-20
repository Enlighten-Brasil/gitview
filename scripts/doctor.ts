/**
 * `pnpm diagnose` — pré-flight de máquina: diz em UMA tela se esta máquina roda
 * o gitview e o que falta quando não roda. Pensado para diagnóstico remoto:
 * dev de outra máquina roda `pnpm diagnose` e cola a saída.
 *
 * Estética do check-scrub/check-data: `✓/⚠/✗ item — detalhe`, exit 1 se
 * qualquer item essencial falhar. NUNCA imprime segredos (só se o token
 * existe). Checagem de rede é best-effort com timeout — offline vira aviso,
 * não falha.
 */
import { spawnSync } from 'node:child_process'
import { accessSync, constants, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { loadConfig, rootDir } from './lib/config'
import { getToken } from './lib/github'
import { discoverRepos, resolveReposRootSafe } from './lib/repos'

type Level = 'ok' | 'warn' | 'fail'
const results: { level: Level, label: string, detail: string }[] = []
const add = (level: Level, label: string, detail: string) => results.push({ level, label, detail })

/** compara a versão atual com a mínima (major.minor[.patch]) */
function versionAtLeast(current: string, min: string): boolean {
  const c = current.split('.').map(Number)
  const m = min.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((c[i] ?? 0) !== (m[i] ?? 0))
      return (c[i] ?? 0) > (m[i] ?? 0)
  }
  return true
}

// node:sqlite sem flag desde 22.13.0 (antes exigia --experimental-sqlite)
const MIN_NODE = '22.13.0'

const gitVersion = (() => {
  const r = spawnSync('git', ['--version'], { encoding: 'utf-8' })
  return r.status === 0 ? r.stdout.trim() : null
})()

console.log(`gitview doctor · ${process.platform} ${process.arch} · node ${process.version} · ${gitVersion ?? 'git ausente'}\n`)

// 1. Node ---------------------------------------------------------------------------
if (versionAtLeast(process.versions.node, MIN_NODE))
  add('ok', 'Node.js', `v${process.versions.node}`)
else
  add('fail', 'Node.js', `v${process.versions.node} < ${MIN_NODE} — instale o LTS 22.13+ (o coletor usa node:sqlite nativo)`)

// 2. node:sqlite ---------------------------------------------------------------------
try {
  const { DatabaseSync } = await import('node:sqlite')
  const probe = new DatabaseSync(':memory:')
  probe.exec('CREATE TABLE t (x INTEGER)')
  probe.close()
  add('ok', 'node:sqlite', 'DatabaseSync operacional')
}
catch (err) {
  add('fail', 'node:sqlite', `indisponível (${(err as Error).message}) — Node abaixo de 22.13 ou build sem SQLite; os coletores não rodam`)
}

// 3. dependências instaladas ----------------------------------------------------------
try {
  accessSync(join(rootDir, 'node_modules', 'tsx', 'dist', 'cli.mjs'), constants.R_OK)
  add('ok', 'dependências', 'node_modules presente (tsx encontrado)')
}
catch {
  add('fail', 'dependências', 'tsx não encontrado — rode `pnpm install`')
}

// 4. git -----------------------------------------------------------------------------
if (gitVersion)
  add('ok', 'git', gitVersion)
else
  add('fail', 'git', 'git não está no PATH — instale o Git (no Windows, Git for Windows)')

// 5. .env / token ----------------------------------------------------------------------
const config = loadConfig()
const token = getToken()?.token
if (token)
  add('ok', 'token do GitHub', 'presente (valor não exibido)')
else
  add('warn', 'token do GitHub', 'ausente — PRs/releases ficam vazios; conecte em /setup ou use `gh auth login`')

// 6. pasta de repositórios ---------------------------------------------------------------
const reposRoot = resolveReposRootSafe(config)
if (!reposRoot) {
  add('fail', 'repositórios', 'nenhuma pasta de repos configurada — rode `pnpm dev` e abra /setup, ou defina GITVIEW_REPOS_ROOT no .env')
}
else {
  const repos = discoverRepos(reposRoot)
  if (repos.length)
    add('ok', 'repositórios', `${repos.length} repo(s) git em ${reposRoot}`)
  else
    add('fail', 'repositórios', `pasta existe mas não contém repos git: ${reposRoot}`)
}

// 7. escrita em data/ e public/data ---------------------------------------------------------
for (const dir of ['data', join('public', 'data')]) {
  const abs = join(rootDir, dir)
  try {
    mkdirSync(abs, { recursive: true })
    const probe = join(abs, '.doctor-probe')
    writeFileSync(probe, 'x')
    rmSync(probe, { force: true })
    add('ok', `escrita em ${dir}/`, 'ok')
  }
  catch (err) {
    add('fail', `escrita em ${dir}/`, `bloqueada (${(err as Error).message}) — antivírus/OneDrive/permissão?`)
  }
}

// 8. fuso canônico ------------------------------------------------------------------------------
const tz = config.timezone ?? 'America/Sao_Paulo'
try {
  new Intl.DateTimeFormat('en-CA', { timeZone: tz }).resolvedOptions()
  add('ok', 'GITVIEW_TIMEZONE', tz)
}
catch {
  add('warn', 'GITVIEW_TIMEZONE', `"${tz}" inválido — os buckets caem para America/Sao_Paulo`)
}

// 9. rede/API (best-effort; offline é aviso, token inválido é falha) --------------------------------
if (token) {
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'gitview-doctor' },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 200)
      add('ok', 'GitHub API', 'autenticada')
    else if (res.status === 401)
      add('fail', 'GitHub API', 'token rejeitado (401) — revogado/expirado; reconecte em /setup')
    else
      add('warn', 'GitHub API', `resposta ${res.status} — pode ser limite de taxa`)
  }
  catch {
    add('warn', 'GitHub API', 'sem rede/timeout (10s) — offline? a coleta usa o cache local dos clones')
  }
}

// relatório -----------------------------------------------------------------------------------------
for (const r of results)
  console.log(`${r.level === 'ok' ? '✓' : r.level === 'warn' ? '⚠' : '✗'} ${r.label} — ${r.detail}`)
const fails = results.filter(r => r.level === 'fail').length
const warns = results.filter(r => r.level === 'warn').length
console.log(`\n${results.length - fails - warns} ok · ${warns} aviso(s) · ${fails} falha(s)`)
if (fails) {
  console.log('Corrija as falhas acima antes de rodar a coleta. Logs de execução: data/logs/.')
  process.exit(1)
}
