import { Buffer } from 'node:buffer'
/**
 * Coletor de estatísticas git multi-repo.
 *
 * 1. Descobre repos git dentro de `reposRoot` (GITVIEW_REPOS_ROOT do .env/shell → data/repos)
 * 2. Roda `git log --all --no-merges --numstat` em cada um (streaming) — merges
 *    ficam fora de todas as métricas (decisão #7; retroativo via `pnpm clean`)
 * 3. Grava commits normalizados em data/gitview.db (node:sqlite nativo)
 * 4. Exporta agregados prontos em public/data/stats.json
 *
 * Re-rodar é incremental: INSERT OR IGNORE por (repo, hash).
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { getOrCreate } from '../src/collections'
import { loadConfig, resolveReposRoot } from './lib/config'
import { getToken, NO_TOKEN_HINT } from './lib/github'
import { initLog } from './lib/log'
import { denyPush, discoverRepos, fetchRepo, isManagedRepo, mapPool, parseGitHub, remoteOf, scrubPersistedToken } from './lib/repos'
import { collectScopeSets } from './lib/scope'
import { resolveAliases } from './lib/team'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

initLog('collect')
const config = loadConfig()

// ---------------------------------------------------------------------------
// aliases de autor (devProfiles do team.local.json)
// ---------------------------------------------------------------------------
const { emailToCanonical } = resolveAliases(config)
function canonicalAuthor(name: string, email: string): string {
  return emailToCanonical.get(email.toLowerCase()) ?? name.trim()
}

// ---------------------------------------------------------------------------
// bots (auto: nome termina com [bot]; extras via config.bots)
// ---------------------------------------------------------------------------
const configBots = new Set((config.bots ?? []).map(b => b.toLowerCase()))
function isBot(name: string): boolean {
  return /\[bot\]$/i.test(name.trim()) || configBots.has(name.toLowerCase())
}

// ---------------------------------------------------------------------------
// git log streaming
// ---------------------------------------------------------------------------
interface RawCommit {
  hash: string
  name: string
  email: string
  date: string
  subject: string
  additions: number
  deletions: number
}

/**
 * Normaliza a author date para UTC ISO com milis ('2026-10-08T18:05:13.000Z').
 * O %aI do git emite o offset original do autor (-03:00, Z…) e, gravado cru,
 * quebrava ordenação e comparação lexicográfica (releases/commits recentes).
 * O instante é preservado — buckets de hora/dia seguem no tz de quem coleta.
 */
function toUtcIso(date: string): string {
  const d = new Date(date)
  return Number.isNaN(d.getTime()) ? date : d.toISOString()
}

/**
 * Exclusão de arquivos gerados/lockfiles nas métricas de LINHAS — filtrada
 * linha a linha no numstat (não no pathspec do git log: pathspec também
 * removeria commits que só tocam lockfile, distorcendo contagens de commits,
 * releases e heatmaps). O commit entra; as linhas do arquivo gerado, não.
 * Nota: o numstat é somado no insert — pra reaplicar no histórico: pnpm clean.
 */
const EXCLUDE_PATTERNS = config.excludePaths ?? []

/**
 * glob simples: '*' dentro do segmento; '**' casa caminho qualquer; padrão com
 * '/' casa o caminho todo (em qualquer profundidade), sem '/' casa o basename.
 * Case-sensitive como gitignore. O placeholder de '**' é um control char — com
 * espaço literal, um glob tipo 'My Dir/*.lock' virava over-match `.*` (follow-up #11)
 */
// cache por execução: a regex só depende do padrão, e o numstat chama
// isExcludedPath por (caminho × padrão) — sem cache recompilava a mesma regex
// milhares de vezes (follow-up #12)
const globCache = new Map<string, RegExp>()

function matchesGlob(path: string, pattern: string): boolean {
  let re = globCache.get(pattern)
  if (!re) {
    const body = pattern
      // '?' precisa de escape: sem ele vira quantifier de regex e o glob
      // '?.lock' sub-exclui silenciosamente (follow-up #12)
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*\*/g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .split('\u0000')
      .join('.*')
    re = pattern.includes('/')
      ? new RegExp(`(^|.*/)${body}$`)
      : new RegExp(`^${body}$`)
    globCache.set(pattern, re)
  }
  return re.test(pattern.includes('/') ? path : (path.split('/').pop() ?? path))
}

const isExcludedPath = (path: string): boolean => EXCLUDE_PATTERNS.some(p => matchesGlob(path, p))

function gitLog(repoPath: string, extraArgs: string[] = []): Promise<RawCommit[]> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', [
      '-C',
      repoPath,
      // --no-merges: commits de merge ficam fora de TODAS as métricas
      // (decisão issue #7 — inflavam commits/dia, ritmo e streaks com +0−0;
      // a "produção" do merge já está no PR). Retroativo: pnpm clean && pnpm collect.
      'log',
      '--all',
      '--no-renames',
      '--no-merges',
      '--pretty=format:%x1e%H%x1f%an%x1f%ae%x1f%aI%x1f%s',
      '--numstat',
      ...extraArgs,
    ])
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => chunks.push(c))
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git log falhou em ${repoPath}: ${Buffer.concat(errChunks).toString()}`))
        return
      }
      resolvePromise(parseGitLog(Buffer.concat(chunks).toString('utf-8')))
    })
  })
}

function parseGitLog(raw: string): RawCommit[] {
  const commits: RawCommit[] = []
  // cada commit começa com \x1e (record separator)
  for (const block of raw.split('\x1E')) {
    if (!block.trim())
      continue
    const lines = block.split('\n')
    const header = lines[0].split('\x1F')
    if (header.length < 5)
      continue
    const [hash, name, email, date, subject] = header
    let additions = 0
    let deletions = 0
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line)
        continue
      const parts = line.split('\t')
      if (parts.length < 3)
        continue
      // linhas de arquivos gerados/lockfiles não somam (o commit entra igual)
      if (isExcludedPath(parts.slice(2).join('\t')))
        continue
      const add = Number(parts[0])
      const del = Number(parts[1])
      if (Number.isFinite(add))
        additions += add
      if (Number.isFinite(del))
        deletions += del
    }
    commits.push({ hash, name, email, date, subject: subject ?? '', additions, deletions })
  }
  return commits
}

/**
 * Set completo de alcançabilidade do repo (issue #120): UM `git rev-list --all`
 * cobre branches (merges inclusos), remote-tracking refs e tags. Os sets do
 * lib/scope.ts NÃO servem para expurgo: rev-list de prod/integrações + walk
 * `--branches --no-merges` deixa de fora merges de branch e commits alcançáveis
 * só por tag. Streaming como o gitLog — repo grande emite centenas de KB.
 */
function gitRevListAll(repoPath: string): Promise<Set<string>> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', ['-C', repoPath, 'rev-list', '--all'])
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => chunks.push(c))
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git rev-list falhou em ${repoPath}: ${Buffer.concat(errChunks).toString().trim()}`))
        return
      }
      resolvePromise(new Set(Buffer.concat(chunks).toString('utf-8').split('\n').filter(Boolean)))
    })
  })
}

// ---------------------------------------------------------------------------
// banco
// ---------------------------------------------------------------------------
mkdirSync(join(root, 'data'), { recursive: true })
mkdirSync(join(root, 'public', 'data'), { recursive: true })

const db = new DatabaseSync(join(root, 'data', 'gitview.db'))
db.exec(`
  CREATE TABLE IF NOT EXISTS commits (
    repo TEXT NOT NULL,
    hash TEXT NOT NULL,
    author TEXT NOT NULL,
    email TEXT NOT NULL,
    date TEXT NOT NULL,
    subject TEXT NOT NULL,
    additions INTEGER NOT NULL DEFAULT 0,
    deletions INTEGER NOT NULL DEFAULT 0,
    -- escopo de ref (issue #118) — 'prod' | 'integration' | 'branch';
    -- NULL = não classificado (nunca tratar NULL como prod)
    scope TEXT,
    -- nome curto do primeiro ref alcançável, melhor esforço (lib/scope.ts);
    -- NULL para commit alcançável só por tag ou só por remote-tracking ref
    -- em checkout normal (limitação #163)
    ref_hint TEXT,
    PRIMARY KEY (repo, hash)
  );
  CREATE INDEX IF NOT EXISTS idx_commits_date ON commits(date);
  CREATE INDEX IF NOT EXISTS idx_commits_author ON commits(author);
`)

const insert = db.prepare(`
  INSERT OR IGNORE INTO commits (repo, hash, author, email, date, subject, additions, deletions)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)

// migração: datas gravadas por versões antigas tinham o offset original do
// autor (-03:00, Z…), o que quebra comparação/ordenação lexicográfica —
// normaliza tudo para UTC ISO com milis (idempotente; instante preservado)
console.log('Aplicando migrações do banco (rápido, mas pode levar segundos em bancos grandes)...')
const migratedDates = db.prepare(`
  UPDATE commits SET date = strftime('%Y-%m-%dT%H:%M:%fZ', date)
  WHERE instr(date, '.') = 0 AND date GLOB '*T*'
`).run()
if (migratedDates.changes)
  console.log(`🔧 ${migratedDates.changes} datas normalizadas para UTC (formato antigo com offset)`)

// migração (issue #118): bancos criados antes da dimensão de escopo não têm as
// colunas scope/ref_hint — ALTER TABLE in-place idempotente (PRAGMA table_info
// detecta as colunas existentes), no padrão da migração de datas acima. Não
// exige clean && collect: a classificação abaixo cobre TODO o histórico via
// sets de rev-list, não o watermark.
const commitCols = (db.prepare('PRAGMA table_info(commits)').all() as { name: string }[]).map(c => c.name)
if (!commitCols.includes('scope'))
  db.exec('ALTER TABLE commits ADD COLUMN scope TEXT')
if (!commitCols.includes('ref_hint'))
  db.exec('ALTER TABLE commits ADD COLUMN ref_hint TEXT')

// ---------------------------------------------------------------------------
// incremental: --since por repo a partir do watermark no banco (max date - margem).
// A margem cobre commits com committer date antiga mergeados depois do watermark;
// o INSERT OR IGNORE torna a sobreposição inócua. `--full` força re-scan completo.
// ---------------------------------------------------------------------------
const FULL = process.argv.includes('--full')
// --reaggregate: pula fetch + git log (nada novo entra) e só re-aplica aliases
// e re-exporta os JSONs — usado pela recoleta leve pós-edição de time (/teams)
const REAGGREGATE = process.argv.includes('--reaggregate')
const SINCE_MARGIN_DAYS = 7
const maxDateStmt = db.prepare('SELECT MAX(date) AS max FROM commits WHERE repo = ?')

function sinceArgs(repoName: string): string[] {
  if (FULL)
    return []
  const row = maxDateStmt.get(repoName) as { max: string | null }
  if (!row.max)
    return []
  // clamp (issue #207): relógio do autor no futuro não pode empurrar a janela
  // e esconder commits novos até um --full — a base nunca passa de now + 24h
  // (margem dos 7 dias continua sendo subtraída depois)
  const d = new Date(Math.min(new Date(row.max).getTime(), Date.now() + 86_400_000))
  d.setDate(d.getDate() - SINCE_MARGIN_DAYS)
  return [`--since=${d.toISOString()}`]
}

// ---------------------------------------------------------------------------
// helpers de agregação
// ---------------------------------------------------------------------------
/**
 * Fuso canônico (issue #8): TODOS os buckets (dia/mês/ISO-semana/fim de
 * semana/madrugada/heatmap) são calculados em GITVIEW_TIMEZONE, nunca no
 * relógio da máquina que coleta — o mesmo banco produz os mesmos buckets em
 * qualquer máquina. Default: o fuso do time (São Paulo); UTC não modela a
 * "madrugada/fd" de ninguém na prática.
 */
const CANON_TZ = (() => {
  const tz = config.timezone ?? 'America/Sao_Paulo'
  try {
    // construído e lido (não só new) — valida o nome IANA sem efeito colateral
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).resolvedOptions()
    return tz
  }
  catch {
    console.warn(`! GITVIEW_TIMEZONE inválido ("${tz}") — caindo para America/Sao_Paulo`)
    return 'America/Sao_Paulo'
  }
})()

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CANON_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
})

interface Canon { y: number, m: number, d: number, h: number, weekday: number }

/** partes do calendário (ano/mês/dia/hora/dia-da-semana) da data no fuso canônico */
function canonParts(date: Date): Canon {
  const fp = partsFmt.formatToParts(date)
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(fp.find(p => p.type === type)?.value ?? '0')
  const y = num('year')
  const m = num('month')
  const d = num('day')
  const h = num('hour') % 24 // alguns engines devolvem 24 para meia-noite
  // dia da semana vem do CALENDÁRIO canônico (nunca do Date do fuso local)
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return { y, m, d, h, weekday }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function isoWeekKeyOf(p: Canon): string {
  const date = new Date(Date.UTC(p.y, p.m - 1, p.d))
  const dayNum = (date.getUTCDay() + 6) % 7 // seg=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const fday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 864e5))
  return `${date.getUTCFullYear()}-W${pad2(week)}`
}

function monthKeyOf(p: Canon): string {
  return `${p.y}-${pad2(p.m)}`
}

function monthKey(d: Date): string {
  return monthKeyOf(canonParts(d))
}

function dayKeyOf(p: Canon): string {
  return `${p.y}-${pad2(p.m)}-${pad2(p.d)}`
}

function nextDayKey(dayKeyStr: string): string {
  // aritmética calendária pura em UTC (nunca Date local — atravessa DST/TZ da
  // máquina e quebraria streaks na mesma data vista de fusos diferentes)
  const [y, m, d] = dayKeyStr.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d) + 86_400_000)
  return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}`
}

/** streak atual (dias consecutivos terminando no último dia ativo) e recorde */
function calcStreaks(days: Set<string>): { streak: number, longestStreak: number } {
  const sorted = [...days].sort()
  let longest = 0
  let run = 0
  let prev = ''
  for (const d of sorted) {
    run = prev && nextDayKey(prev) === d ? run + 1 : 1
    if (run > longest)
      longest = run
    prev = d
  }
  return { streak: run, longestStreak: longest }
}

// ---------------------------------------------------------------------------
// eixos de escopo do autor (issue #152): prod = scope 'prod'; progress =
// 'integration' + 'branch'. Acumulados na MESMA passada do banco que a linha
// integral de perAuthor — os streaks rodam no Set de dias de cada eixo.
// ---------------------------------------------------------------------------
interface AxisAcc { commits: number, additions: number, deletions: number, repos: Set<string>, days: Set<string>, last: string }
function newAxisAcc(): AxisAcc {
  return { commits: 0, additions: 0, deletions: 0, repos: new Set<string>(), days: new Set<string>(), last: '' }
}
/** eixo pronto pro JSON: os mesmos campos medidos da linha perAuthor integral */
function axisOut(ax: AxisAcc) {
  return { commits: ax.commits, additions: ax.additions, deletions: ax.deletions, repos: ax.repos.size, activeDays: ax.days.size, lastCommit: ax.last, ...calcStreaks(ax.days) }
}

// ---------------------------------------------------------------------------
// tipo do commit pelo prefixo conventional commits (feat/fix/chore/...)
// ---------------------------------------------------------------------------
const KNOWN_TYPES = new Set(['feat', 'fix', 'chore', 'refactor', 'docs', 'test', 'perf', 'style', 'build', 'ci'])
function commitType(subject: string): string {
  const m = subject.match(/^([a-z]+)(\([^)]*\))?!?:/i)
  if (!m)
    return 'outros'
  const t = m[1].toLowerCase()
  return KNOWN_TYPES.has(t) ? t : 'outros'
}

/** remote origin -> URL web https (para link de commit); null se não for GitHub */
function repoWebUrl(path: string): string | null {
  const remote = remoteOf(path)
  const gh = remote ? parseGitHub(remote) : null
  return gh ? `https://github.com/${gh.owner}/${gh.repo}` : null
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const repos = discoverRepos(resolveReposRoot(config))
  console.log(`Repos encontrados: ${repos.length}`)
  repos.forEach(r => console.log(`  - ${r.name}`))

  // clones gerenciados (data/repos) não têm dono que dê pull — atualiza aqui.
  // denyPush é idempotente: garante a trava read-only também em clones antigos.
  // scrubPersistedToken apaga o extraheader que versões antigas gravavam no
  // clone (token em repouso) — o fetch agora injeta o token só no processo.
  const managed = repos.filter(r => isManagedRepo(r.path))
  if (managed.length && !REAGGREGATE) {
    const token = getToken()?.token
    if (!token)
      console.warn(`! ${NO_TOKEN_HINT} — fetch dos clones vai usar só o cache local`)
    console.log(`\nAtualizando ${managed.length} clones gerenciados (git fetch)...`)
    await mapPool(managed, 4, async (repo) => {
      denyPush(repo.path)
      scrubPersistedToken(repo.path)
      const err = await fetchRepo(repo.path, token)
      if (err)
        console.warn(`! ${repo.name}: fetch falhou, usando cache local (${err.split('\n')[0]})`)
    })
  }

  console.log(FULL ? 'Modo: completo (--full)' : REAGGREGATE ? 'Modo: reagregação (--reaggregate, sem git)' : 'Modo: incremental (--since por repo)')

  // repos que saíram da seleção (setup refeito, exclude, etc.) somem do banco —
  // se voltarem um dia, o watermark vazio força re-scan completo deles
  if (repos.length) {
    const placeholders = repos.map(() => '?').join(',')
    const pruned = db.prepare(`DELETE FROM commits WHERE repo NOT IN (${placeholders})`).run(...repos.map(r => r.name))
    if (pruned.changes)
      console.log(`🧹 ${pruned.changes} commits removidos de repos fora da seleção`)
  }

  if (!REAGGREGATE) {
    await mapPool(repos, 4, async (repo) => {
      const t0 = Date.now()
      console.log(`→ ${repo.name}: lendo histórico (git log --numstat)...`)
      let inTransaction = false
      try {
        const commits = await gitLog(repo.path, sinceArgs(repo.name))
        let inserted = 0
        db.exec('BEGIN')
        inTransaction = true
        for (const c of commits) {
          const res = insert.run(
            repo.name,
            c.hash,
            canonicalAuthor(c.name, c.email),
            c.email.toLowerCase(),
            toUtcIso(c.date),
            c.subject.slice(0, 500),
            c.additions,
            c.deletions,
          )
          inserted += Number(res.changes)
        }
        db.exec('COMMIT')
        inTransaction = false
        console.log(`✓ ${repo.name}: ${commits.length} commits lidos, ${inserted} novos (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
      }
      catch (err) {
        if (inTransaction)
          db.exec('ROLLBACK')
        console.error(`✗ ${repo.name}: ${(err as Error).message}`)
      }
    })

    // -----------------------------------------------------------------------
    // classificação por escopo de ref (issue #118) — roda em TODO collect com
    // git, não só nos inserts: sets completos por repo via lib/scope.ts
    // (prod = alcançável da ref de produção; integration = alcançável das refs
    // de integração e não de prod; branch = demais, por eliminação). UPDATE só
    // nas linhas que mudaram — commit de branch mergeada vira 'prod' na
    // coleta incremental seguinte, sem --full. Falha num repo não derruba a
    // coleta: as linhas dele mantêm o scope anterior (ou NULL), no padrão de
    // tolerância do passo de inserts.
    // -----------------------------------------------------------------------
    console.log('\nClassificando commits por escopo de ref (prod/integration/branch)...')
    const scopeT0 = Date.now()
    const selectScoped = db.prepare('SELECT hash, scope, ref_hint FROM commits WHERE repo = ?')
    const updateScope = db.prepare('UPDATE commits SET scope = ?, ref_hint = ? WHERE repo = ? AND hash = ?')
    let scopeUpdated = 0
    let scopeFailed = 0
    await mapPool(repos, 4, async (repo) => {
      const t0 = Date.now()
      try {
        console.log(`→ ${repo.name}: classificando escopo de ref...`)
        const rows = selectScoped.all(repo.name) as { hash: string, scope: string | null, ref_hint: string | null }[]
        if (!rows.length)
          return
        const sets = await collectScopeSets(repo.path, config.productionRef, config.integrationRefs)
        const counts = { branch: 0, integration: 0, prod: 0 }
        let updated = 0
        db.exec('BEGIN')
        try {
          for (const row of rows) {
            const scope = sets.prod.has(row.hash)
              ? 'prod'
              : sets.integ.has(row.hash)
                ? 'integration'
                : 'branch'
            const hint = scope === 'prod'
              ? sets.prodRef
              : scope === 'integration'
                ? (sets.integ.get(row.hash) ?? null)
                : (sets.hints.get(row.hash) ?? null)
            counts[scope]++
            if (row.scope !== scope || row.ref_hint !== hint) {
              updateScope.run(scope, hint, repo.name, row.hash)
              updated++
            }
          }
          db.exec('COMMIT')
        }
        catch (err) {
          db.exec('ROLLBACK')
          throw err
        }
        scopeUpdated += updated
        console.log(`✓ ${repo.name}: escopo prod ${counts.prod} · integration ${counts.integration} · branch ${counts.branch} — ${updated} linhas atualizadas (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
      }
      catch (err) {
        scopeFailed++
        console.error(`✗ ${repo.name}: classificação de escopo falhou — linhas mantêm scope anterior/NULL (${(err as Error).message})`)
      }
    })
    console.log(`🏷 Escopo classificado em ${((Date.now() - scopeT0) / 1000).toFixed(1)}s (pool de 4, ${repos.length} repos) — ${scopeUpdated} linhas atualizadas${scopeFailed ? ` · ${scopeFailed} repos com falha` : ''}`)

    // -----------------------------------------------------------------------
    // expurgo de commits inalcançáveis (issue #120) — INSERT OR IGNORE nunca
    // remove e o fetch --prune acima já descartou refs mortos: branch
    // squash-mergeada e apagada no remote (fluxo padrão do GitHub) deixaria os
    // commits originais no banco para sempre, inflando o 'Tudo'. SOMENTE clones
    // gerenciados, que acabaram de receber fetch --prune nesta execução —
    // checkout normal pode estar com refs desatualizados sem fetch, e não se
    // expurga o que não se atualizou. Um fetch que falhou não muda os refs,
    // então tampouco cria inalcançável falso. O set é UM `git rev-list --all`
    // próprio por repo (custo medido: 1,2 s somado nos 14 repos reais, pior
    // repo 0,3 s). Watermark: expurgar commits recentes abaixa o MAX(date) do
    // repo e só alarga o --since da próxima coleta — benigno, o INSERT OR
    // IGNORE absorve a sobreposição. Nunca roda no --reaggregate (este bloco
    // vive dentro do if (!REAGGREGATE)): sem git não há alcançabilidade nova.
    // -----------------------------------------------------------------------
    const managedForPurge = repos.filter(r => isManagedRepo(r.path))
    const purgeT0 = Date.now()
    let purgedTotal = 0
    if (managedForPurge.length) {
      console.log(`\nExpurgando commits inalcançáveis em ${managedForPurge.length} clones gerenciados (rev-list --all)...`)
      const selectHashes = db.prepare('SELECT hash FROM commits WHERE repo = ?')
      const deleteUnreachable = db.prepare('DELETE FROM commits WHERE repo = ? AND hash = ?')
      await mapPool(managedForPurge, 4, async (repo) => {
        const t0 = Date.now()
        try {
          const rows = selectHashes.all(repo.name) as { hash: string }[]
          if (!rows.length)
            return
          const reachable = await gitRevListAll(repo.path)
          // guarda defensiva: rev-list vazio com linhas no banco é anomalia
          // (refs zerados/clone corrompido) — pular preserva o histórico
          if (!reachable.size) {
            console.warn(`! ${repo.name}: rev-list --all vazio com ${rows.length} commits no banco — expurgo pulado`)
            return
          }
          const dead = rows.filter(r => !reachable.has(r.hash))
          if (!dead.length)
            return
          // diff em JS + DELETE por hash em transação (set com dezenas de
          // milhares de hashes nunca vira NOT IN literal); node:sqlite é
          // síncrono — nenhum await entre BEGIN e COMMIT
          let removed = 0
          db.exec('BEGIN')
          try {
            for (const row of dead)
              removed += Number(deleteUnreachable.run(repo.name, row.hash).changes)
            db.exec('COMMIT')
          }
          catch (err) {
            db.exec('ROLLBACK')
            throw err
          }
          purgedTotal += removed
          if (removed > 0)
            console.log(`🧹 ${repo.name}: ${removed} commits inalcançáveis removidos (branches apagadas) (${((Date.now() - t0) / 1000).toFixed(1)}s)`)
        }
        catch (err) {
          // falha num repo não derruba a coleta (padrão dos passos acima):
          // as linhas dele simplesmente ficam como estão
          console.error(`✗ ${repo.name}: expurgo falhou — linhas mantidas (${(err as Error).message})`)
        }
      })
    }
    if (repos.length) {
      const skippedUnmanaged = repos.length - managedForPurge.length
      const skipNote = skippedUnmanaged ? ` · ${skippedUnmanaged} repos não gerenciados pulados (refs podem estar desatualizados sem fetch)` : ''
      const secs = ((Date.now() - purgeT0) / 1000).toFixed(1)
      if (purgedTotal > 0)
        console.log(`🧹 Expurgo: ${purgedTotal} commits inalcançáveis removidos em ${secs}s (${managedForPurge.length} clones gerenciados${skipNote})`)
      else
        console.log(`✓ Expurgo: nenhum commit inalcançável (${managedForPurge.length} clones gerenciados verificados em ${secs}s${skipNote})`)
    }
  }
  else {
    // --reaggregate não roda git: a classificação pula inteira e linhas com
    // scope NULL continuam NULL. NULL jamais é tratado como prod (rotularia
    // errado o trabalho em progresso) — por isso o aviso e a ausência de
    // contagens por escopo neste modo.
    const nullScope = db.prepare('SELECT COUNT(*) AS n FROM commits WHERE scope IS NULL').get() as { n: number }
    if (nullScope.n > 0)
      console.warn(`⚠ ${nullScope.n} commits com scope NULL no banco — rode pnpm collect para classificar (a reagregação não roda git; contagens por escopo suprimidas)`)
  }

  // re-normaliza autores já gravados caso os aliases tenham mudado no config
  const updateAuthor = db.prepare('UPDATE commits SET author = ? WHERE email = ? AND author != ?')
  for (const [email, canonical] of emailToCanonical) {
    updateAuthor.run(canonical, email, canonical)
  }

  // -------------------------------------------------------------------------
  // agregação -> stats.json
  // -------------------------------------------------------------------------
  console.log('\nAgregando...')
  const rows = db.prepare(`
    SELECT repo, author, email, date, subject, additions, deletions, scope FROM commits ORDER BY date ASC
  `).all() as { repo: string, author: string, email: string, date: string, subject: string, additions: number, deletions: number, scope: string | null }[]

  const emailsByAuthor = new Map<string, Set<string>>()
  // separador das chaves de agregação: \u0001 — nome de autor/repo com '|'
  // colidia e deslocava campos no split (follow-up #11)
  const KEY_SEP = '\u0001'
  const weekly = new Map<string, { commits: number, weekend: number, night: number }>() // week/repo/author/scope
  const monthly = new Map<string, { commits: number, additions: number, deletions: number }>() // month/repo/author/scope
  // agregado dia-preciso (issue #175): os mesmos predicados de weekend/night do
  // weekly + as linhas do monthly numa chave só (day/repo/author/scope) — alimenta
  // relatórios de períodos rolantes (7d/30d) dia-precisos, sem aproximar por
  // semana/mês. Sai em public/data/daily.json (lazy, fora do boot como commits.json)
  const daily = new Map<string, { commits: number, additions: number, deletions: number, weekend: number, night: number }>() // day/repo/author/scope
  const monthlyTypes = new Map<string, number>() // month/repo/author/scope/type
  const heatmap = new Map<string, number>() // author/repo/month/weekday/hour/scope
  // heatmap ganha dimensão de mês pro filtro de período funcionar no frontend;
  // limita aos últimos 24 meses (cobre o maior range do filtro) pra não inflar o JSON
  const heatmapCutoff = new Date()
  // setUTC* em vez de local: o corte é de instantes; local addiria ruído de
  // fuso no limiar (o monthKey do resultado continua canônico)
  heatmapCutoff.setUTCMonth(heatmapCutoff.getUTCMonth() - 24)
  const heatmapCutoffKey = monthKey(heatmapCutoff)
  const perAuthor = new Map<string, { commits: number, additions: number, deletions: number, repos: Set<string>, days: Set<string>, last: string, axes: { prod: AxisAcc, progress: AxisAcc } }>()
  const perRepo = new Map<string, { commits: number, prodCommits: number, progressCommits: number, additions: number, deletions: number, authors: Set<string>, last: string }>()
  let totalAdd = 0
  let totalDel = 0
  // escopo (issue #119): as chaves de agregação incluem o scope do banco
  // ('prod'|'integration'|'branch'); no JSON a codificação é omit-prod (campo
  // só quando ≠ prod). NULL jamais vira prod — a linha fica fora de tudo.
  let totalProd = 0
  let totalProgress = 0
  const allDays = new Set<string>()
  // linhas com data quebrada ficam fora de TODO bucket — os totals derivam das
  // linhas agregadas (senão o invariante Σmonthly == totals do check-data aponta
  // a diferença sem dizer a origem — follow-up #11)
  let aggregated = 0
  let skippedBadDate = 0
  let skippedNoScope = 0

  for (const r of rows) {
    const d = new Date(r.date)
    if (Number.isNaN(d.getTime())) {
      skippedBadDate++
      continue
    }
    // scope não classificado (NULL — repo com falha na classificação ou banco
    // legado sem collect com git) fica fora de TODO bucket, no padrão da data
    // quebrada acima: rotular como prod rotularia errado o trabalho em progresso
    const scope = r.scope === 'prod' || r.scope === 'integration' || r.scope === 'branch' ? r.scope : null
    if (scope === null) {
      skippedNoScope++
      continue
    }
    aggregated++
    const cp = canonParts(d) // uma única vez por linha — todos os buckets vêm dela
    const month = monthKeyOf(cp)
    getOrCreate(emailsByAuthor, r.author, () => new Set<string>()).add(r.email)

    const wk = `${isoWeekKeyOf(cp)}${KEY_SEP}${r.repo}${KEY_SEP}${r.author}${KEY_SEP}${scope}`
    const wkCur = weekly.get(wk) ?? { commits: 0, weekend: 0, night: 0 }
    wkCur.commits++
    if (cp.weekday === 0 || cp.weekday === 6)
      wkCur.weekend++
    if (cp.h >= 22 || cp.h < 6)
      wkCur.night++
    weekly.set(wk, wkCur)

    const mk = `${month}${KEY_SEP}${r.repo}${KEY_SEP}${r.author}${KEY_SEP}${scope}`
    const mCur = monthly.get(mk) ?? { commits: 0, additions: 0, deletions: 0 }
    mCur.commits++
    mCur.additions += r.additions
    mCur.deletions += r.deletions
    monthly.set(mk, mCur)

    const tk = `${mk}${KEY_SEP}${commitType(r.subject)}`
    monthlyTypes.set(tk, (monthlyTypes.get(tk) ?? 0) + 1)

    if (month >= heatmapCutoffKey) {
      const hk = `${r.author}${KEY_SEP}${r.repo}${KEY_SEP}${month}${KEY_SEP}${cp.weekday}${KEY_SEP}${cp.h}${KEY_SEP}${scope}`
      heatmap.set(hk, (heatmap.get(hk) ?? 0) + 1)
    }

    const dk = dayKeyOf(cp)
    allDays.add(dk)

    // linha dia-preciso (issue #175): MESMAS regras de skip da data quebrada e do
    // scope NULL acima; dia é o canônico (dayKeyOf) — r.date.slice(0,10) é UTC e
    // deslocaria o corte de dias (divergiria de totals.activeDays). Predicados de
    // weekend/night idênticos aos do weekly (relatórios off-hours em qualquer janela)
    const dKey = `${dk}${KEY_SEP}${r.repo}${KEY_SEP}${r.author}${KEY_SEP}${scope}`
    const dCur = daily.get(dKey) ?? { commits: 0, additions: 0, deletions: 0, weekend: 0, night: 0 }
    dCur.commits++
    dCur.additions += r.additions
    dCur.deletions += r.deletions
    if (cp.weekday === 0 || cp.weekday === 6)
      dCur.weekend++
    if (cp.h >= 22 || cp.h < 6)
      dCur.night++
    daily.set(dKey, dCur)

    const pa = getOrCreate(perAuthor, r.author, () => ({ commits: 0, additions: 0, deletions: 0, repos: new Set<string>(), days: new Set<string>(), last: '', axes: { prod: newAxisAcc(), progress: newAxisAcc() } }))
    pa.commits++
    pa.additions += r.additions
    pa.deletions += r.deletions
    pa.repos.add(r.repo)
    pa.days.add(dk)
    if (r.date > pa.last)
      pa.last = r.date
    // eixos por escopo (issue #152): a mesma passada alimenta o eixo da linha —
    // o scope aqui nunca é NULL (linhas não classificadas ficaram fora de TODO
    // bucket acima, mesma convenção/aviso dos totals)
    const ax = scope === 'prod' ? pa.axes.prod : pa.axes.progress
    ax.commits++
    ax.additions += r.additions
    ax.deletions += r.deletions
    ax.repos.add(r.repo)
    ax.days.add(dk)
    if (r.date > ax.last)
      ax.last = r.date

    const pr = getOrCreate(perRepo, r.repo, () => ({ commits: 0, prodCommits: 0, progressCommits: 0, additions: 0, deletions: 0, authors: new Set<string>(), last: '' }))
    pr.commits++
    pr.additions += r.additions
    pr.deletions += r.deletions
    pr.authors.add(r.author)
    if (r.date > pr.last)
      pr.last = r.date

    if (scope === 'prod') {
      totalProd++
      pr.prodCommits++
    }
    else {
      totalProgress++
      pr.progressCommits++
    }

    totalAdd += r.additions
    totalDel += r.deletions
  }

  const stats = {
    generatedAt: new Date().toISOString(),
    repos: repos.map(r => r.name),
    repoUrls: Object.fromEntries(
      repos.map(r => [r.name, repoWebUrl(r.path)]).filter(([, url]) => url != null),
    ),
    authors: [...emailsByAuthor.entries()]
      .map(([name, emails]) => ({ name, emails: [...emails].sort(), bot: isBot(name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    totals: {
      commits: aggregated,
      prodCommits: totalProd,
      progressCommits: totalProgress,
      additions: totalAdd,
      deletions: totalDel,
      activeDays: allDays.size,
      repos: repos.length,
      authors: perAuthor.size,
    },
    perRepo: [...perRepo.entries()]
      .map(([repo, v]) => ({ repo, commits: v.commits, prodCommits: v.prodCommits, progressCommits: v.progressCommits, additions: v.additions, deletions: v.deletions, authors: v.authors.size, lastCommit: v.last }))
      .sort((a, b) => b.commits - a.commits),
    // byScope (issue #152): os dois eixos SEMPRE presentes quando o campo
    // existe (autor só-progress tem o eixo prod zerado) — a filosofia
    // omit-prod rege o campo `scope` das linhas, não as chaves do byScope.
    // Ausente só em stats.json gerado por versão anterior (feature-detect).
    perAuthor: [...perAuthor.entries()]
      .map(([author, v]) => ({ author, commits: v.commits, additions: v.additions, deletions: v.deletions, repos: v.repos.size, activeDays: v.days.size, lastCommit: v.last, ...calcStreaks(v.days), byScope: { prod: axisOut(v.axes.prod), progress: axisOut(v.axes.progress) } }))
      .sort((a, b) => b.commits - a.commits),
    // encoding omit-prod (issue #119): o campo scope só viaja quando ≠ 'prod'
    // (ausente = prod) — os três valores explícitos vivem só no banco
    weekly: [...weekly.entries()].map(([k, v]) => {
      const [week, repo, author, scope] = k.split(KEY_SEP)
      return { week, repo, author, ...(scope === 'prod' ? {} : { scope }), commits: v.commits, weekend: v.weekend, night: v.night }
    }),
    monthly: [...monthly.entries()].map(([k, v]) => {
      const [month, repo, author, scope] = k.split(KEY_SEP)
      return { month, repo, author, ...(scope === 'prod' ? {} : { scope }), commits: v.commits, additions: v.additions, deletions: v.deletions }
    }),
    heatmap: [...heatmap.entries()].map(([k, commits]) => {
      const [author, repo, month, weekday, hour, scope] = k.split(KEY_SEP)
      return { author, repo, month, weekday: Number(weekday), hour: Number(hour), ...(scope === 'prod' ? {} : { scope }), commits }
    }),
    monthlyTypes: [...monthlyTypes.entries()].map(([k, commits]) => {
      const [month, repo, author, scope, type] = k.split(KEY_SEP)
      return { month, repo, author, ...(scope === 'prod' ? {} : { scope }), type, commits }
    }),
  }

  const out = join(root, 'public', 'data', 'stats.json')
  writeFileSync(out, JSON.stringify(stats))
  const kb = (JSON.stringify(stats).length / 1024).toFixed(0)
  console.log(`\nstats.json gerado (${kb} KB) com ${stats.totals.commits} commits (prod ${totalProd} + progresso ${totalProgress}) de ${stats.totals.authors} autores em ${repos.length} repos.`)

  // daily.json (issue #175): MESMO padrão do commits.json — arquivo próprio, lazy,
  // fora do boot (embutir em stats.json custaria ~+61% no carregamento). SEM cutoff:
  // histórico completo (~145 linhas/mês ≈ +19 KB/ano; reavaliar perto de ~2 MB) — o
  // delta da onda 2 (relatórios) depende literalmente do histórico inteiro.
  // Sem sort: a ordem de inserção vem do ORDER BY date ASC do banco (determinística)
  writeFileSync(join(root, 'public', 'data', 'daily.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    daily: [...daily.entries()].map(([k, v]) => {
      const [day, repo, author, scope] = k.split(KEY_SEP)
      return { day, repo, author, ...(scope === 'prod' ? {} : { scope }), commits: v.commits, additions: v.additions, deletions: v.deletions, weekend: v.weekend, night: v.night }
    }),
  }))
  console.log(`daily.json gerado com ${daily.size} linhas dia×repo×autor (histórico completo, lazy).`)
  if (skippedBadDate > 0)
    console.warn(`⚠ ${skippedBadDate}/${rows.length} linhas no banco têm data inválida e ficaram fora de TODAS as métricas — rode pnpm clean && pnpm collect se o número parecer errado`)
  if (skippedNoScope > 0)
    console.warn(`⚠ ${skippedNoScope}/${rows.length} linhas no banco têm scope NULL (não classificado) e ficaram fora de TODAS as métricas — rode pnpm collect com git para classificar (a reagregação não roda git)`)
  // avisos de escopo que só o banco enxerga (ref_hint não viaja no JSON —
  // decisão da issue #119: check-data valida só o que os JSONs mostram):
  // branch commits alcançáveis só por tag têm ref_hint NULL por construção
  const branchNoHint = db.prepare(`SELECT COUNT(*) AS n FROM commits WHERE scope = 'branch' AND ref_hint IS NULL`).get() as { n: number }
  if (branchNoHint.n > 0)
    console.warn(`⚠ ${branchNoHint.n} commits 'branch' sem ref_hint no banco (alcançáveis só por tag) — contagens de escopo ok; só o hint da ref está ausente`)

  // commits recentes por autor (página de perfil do dev) — últimos 100 de cada
  const recent = db.prepare(`
    SELECT repo, hash, author, date, subject, additions, deletions, scope FROM commits ORDER BY date DESC
  `).all() as { repo: string, hash: string, author: string, date: string, subject: string, additions: number, deletions: number, scope: string | null }[]
  const perAuthorCount = new Map<string, number>()
  const recentCommits = []
  for (const c of recent) {
    // mesma codificação omit-prod dos agregados (issue #119); linha não
    // classificada (scope NULL) fica fora da amostra — sem o campo ela seria
    // lida como prod, rotulando errado trabalho em progresso
    if (c.scope !== 'prod' && c.scope !== 'integration' && c.scope !== 'branch')
      continue
    const n = perAuthorCount.get(c.author) ?? 0
    if (n >= 100)
      continue
    perAuthorCount.set(c.author, n + 1)
    recentCommits.push({
      hash: c.hash.slice(0, 7),
      repo: c.repo,
      author: c.author,
      date: c.date,
      message: c.subject,
      additions: c.additions,
      deletions: c.deletions,
      ...(c.scope === 'prod' ? {} : { scope: c.scope }),
    })
  }
  writeFileSync(join(root, 'public', 'data', 'commits.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    commits: recentCommits,
  }))
  console.log(`commits.json gerado com ${recentCommits.length} commits recentes.`)
  db.close()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
