/**
 * Sanity check dos JSONs gerados pelos coletores — roda no fim do `pnpm collect`
 * (e como último passo do /__collect na UI). Não regenera nada: só lê public/data/*
 * e falha (exit 1) se o shape quebrar, antes de a UI estranhar os dados.
 *
 * ponytail: asserts de superfície (campos que os loaders/computed do src/ leem).
 * Quando um painel quebrar por dado novo, adiciona o campo aqui.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { isProgressScope, isPrReviewState } from '../src/types'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')

const errors: string[] = []
/** avisos de qualidade (não bloqueiam a coleta) — anomalias que valem revisão */
const warnings: string[] = []

function check(cond: boolean, msg: string): void {
  if (!cond)
    errors.push(msg)
}

function warn(cond: boolean, msg: string): void {
  if (!cond)
    warnings.push(msg)
}

function load(file: string): Record<string, unknown> | null {
  const path = join(DATA_DIR, file)
  if (!existsSync(path)) {
    errors.push(`${file}: ausente — rode \`pnpm collect\``)
    return null
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      errors.push(`${file}: esperado objeto no topo`)
      return null
    }
    return parsed as Record<string, unknown>
  }
  catch (err) {
    errors.push(`${file}: JSON inválido (${(err as Error).message})`)
    return null
  }
}

function isArr(o: unknown): o is unknown[] {
  return Array.isArray(o)
}

/** lista existe e (se não-vazia) tem os campos pedidos no 1º item */
function listShape(data: Record<string, unknown>, key: string, fields: string[], where: string, allowEmpty = true): void {
  const v = data[key]
  if (!isArr(v)) {
    errors.push(`${where}.${key}: esperado lista, veio ${typeof v}`)
    return
  }
  if (!v.length) {
    if (!allowEmpty)
      errors.push(`${where}.${key}: lista vazia`)
    return
  }
  const first = v[0]
  if (typeof first !== 'object' || first === null) {
    errors.push(`${where}.${key}[0]: esperado objeto, veio ${typeof first}`)
    return
  }
  for (const f of fields) {
    if (!(f in (first as Record<string, unknown>)))
      errors.push(`${where}.${key}[0]: campo ausente "${f}"`)
  }
}

function genAt(data: Record<string, unknown>, where: string): void {
  const g = data.generatedAt
  if (typeof g !== 'string' || Number.isNaN(Date.parse(g)))
    errors.push(`${where}.generatedAt: ISO inválido`)
}

/** lista de strings (ex.: stats.repos) */
function stringList(data: Record<string, unknown>, key: string, where: string): void {
  const v = data[key]
  if (!isArr(v) || !v.every(x => typeof x === 'string'))
    errors.push(`${where}.${key}: esperado lista de strings`)
}

/**
 * `scope` opcional das linhas (omit-prod, issue #119): campo PRESENTE implica
 * pertencer à union fechada ('integration','branch') — ausente = prod.
 * Validação condicional (padrão PR_REVIEW_STATES) porque o listShape olha só o
 * 1º item e ele pode ser prod, sem o campo.
 */
function scopeUnion(list: unknown, where: string): void {
  for (const r of (isArr(list) ? list : []) as Record<string, unknown>[]) {
    if ('scope' in r && !isProgressScope(r.scope)) {
      errors.push(`${where}: scope inesperado "${String(r.scope)}" — union fechada ('integration','branch'); prod não viaja no JSON (campo ausente)`)
      break
    }
  }
}

// ── stats.json ────────────────────────────────────────────────────────────
const stats = load('stats.json')
const perRepoCommits = new Map<string, number>()
if (stats) {
  genAt(stats, 'stats.json')
  stringList(stats, 'repos', 'stats.json')
  listShape(stats, 'authors', ['name', 'emails', 'bot'], 'stats.json')
  listShape(stats, 'perRepo', ['repo', 'commits', 'prodCommits', 'progressCommits'], 'stats.json')
  listShape(stats, 'perAuthor', ['author', 'commits'], 'stats.json')
  listShape(stats, 'weekly', ['week', 'commits'], 'stats.json')
  listShape(stats, 'monthly', ['month', 'commits'], 'stats.json')
  listShape(stats, 'heatmap', ['author', 'weekday', 'hour', 'commits'], 'stats.json')
  listShape(stats, 'monthlyTypes', ['month', 'type', 'commits'], 'stats.json')
  scopeUnion(stats.weekly, 'stats.weekly')
  scopeUnion(stats.monthly, 'stats.monthly')
  scopeUnion(stats.heatmap, 'stats.heatmap')
  scopeUnion(stats.monthlyTypes, 'stats.monthlyTypes')
  if (!stats.repoUrls || typeof stats.repoUrls !== 'object')
    errors.push('stats.json.repoUrls: esperado objeto')
  // commits por autor somam >= 0 e authors tem flag bot booleana
  if (isArr(stats.authors)) {
    for (const a of stats.authors as Record<string, unknown>[]) {
      if (typeof a.bot !== 'boolean') {
        errors.push(`stats.authors["${a.name}"].bot: não booleano`)
        break
      }
    }
  }

  // invariantes numéricas e de datas (todas as listas já foram geradas — varre tudo)
  const totals = stats.totals as Record<string, unknown> | undefined
  const sum = (list: unknown, key: string) => (isArr(list) ? (list as Record<string, unknown>[]).reduce((s, r) => s + (Number(r[key]) || 0), 0) : -1)
  if (totals && typeof totals.commits === 'number') {
    check(sum(stats.perAuthor, 'commits') === totals.commits, `stats.json: ΣperAuthor.commits (${sum(stats.perAuthor, 'commits')}) != totals.commits (${totals.commits})`)
    check(sum(stats.perRepo, 'commits') === totals.commits, `stats.json: ΣperRepo.commits (${sum(stats.perRepo, 'commits')}) != totals.commits (${totals.commits})`)
    check(sum(stats.monthly, 'commits') === totals.commits, `stats.json: Σmonthly.commits (${sum(stats.monthly, 'commits')}) != totals.commits (${totals.commits})`)
    check(typeof totals.additions === 'number' && totals.additions >= 0 && typeof totals.deletions === 'number' && totals.deletions >= 0, 'stats.json.totals: additions/deletions negativos')
    // split de escopo (issue #119): prod + progresso recompõem o total e a
    // partição do monthly (linha sem scope = prod; com scope = progresso)
    // reproduz as contagens do totals. Heatmap fica FORA de invariante de soma:
    // o corte de 24M quebra Σ por design.
    if (typeof totals.prodCommits !== 'number' || typeof totals.progressCommits !== 'number') {
      errors.push('stats.json.totals: prodCommits/progressCommits ausentes ou não numéricos — rode a coleta de novo')
    }
    else {
      check(totals.prodCommits + totals.progressCommits === totals.commits, `stats.json: totals.prodCommits (${totals.prodCommits}) + totals.progressCommits (${totals.progressCommits}) != totals.commits (${totals.commits})`)
      let monthProd = 0
      let monthProgress = 0
      for (const m of (isArr(stats.monthly) ? stats.monthly : []) as Record<string, unknown>[]) {
        if ('scope' in m)
          monthProgress += Number(m.commits) || 0
        else
          monthProd += Number(m.commits) || 0
      }
      check(monthProd === totals.prodCommits, `stats.json: Σmonthly.commits sem scope (${monthProd}) != totals.prodCommits (${totals.prodCommits})`)
      check(monthProgress === totals.progressCommits, `stats.json: Σmonthly.commits com scope (${monthProgress}) != totals.progressCommits (${totals.progressCommits})`)
    }
  }
  const now = Date.now()
  for (const r of (isArr(stats.perRepo) ? stats.perRepo : []) as Record<string, unknown>[]) {
    perRepoCommits.set(String(r.repo), Number(r.commits) || 0)
    // config suspeita (aviso, não bloqueia): repo com commits mas nada alcançável
    // da ref de produção — productionRef provavelmente não casa com nenhuma ref
    warn(!(Number(r.commits) > 0 && Number(r.prodCommits) === 0), `stats.perRepo["${r.repo}"]: ${Number(r.commits)} commits e nenhum em produção (prodCommits=0) — configuração da ref de produção suspeita`)
    const t = Date.parse(String(r.lastCommit ?? ''))
    if (Number.isNaN(t)) {
      errors.push(`stats.perRepo["${r.repo}"].lastCommit: data inválida`)
      continue
    }
    warn(t <= now + 86_400_000, `stats.perRepo["${r.repo}"].lastCommit no futuro (${r.lastCommit}) — relógio do autor errado? (quebra o watermark incremental)`)
  }
  for (const a of (isArr(stats.perAuthor) ? stats.perAuthor : []) as Record<string, unknown>[]) {
    if (Number(a.commits) < 0 || Number(a.additions) < 0 || Number(a.deletions) < 0)
      errors.push(`stats.perAuthor["${a.author}"]: contagem negativa`)
  }
  for (const h of (isArr(stats.heatmap) ? stats.heatmap : []) as Record<string, unknown>[]) {
    if (Number(h.weekday) < 0 || Number(h.weekday) > 6 || Number(h.hour) < 0 || Number(h.hour) > 23) {
      errors.push(`stats.heatmap: weekday/hour fora da faixa (${h.weekday}/${h.hour})`)
      break
    }
  }
  for (const m of (isArr(stats.monthly) ? stats.monthly : []) as Record<string, unknown>[]) {
    if (!/^\d{4}-\d{2}$/.test(String(m.month))) {
      errors.push(`stats.monthly: month fora do formato YYYY-MM ("${m.month}")`)
      break
    }
  }
}

// ── commits.json ──────────────────────────────────────────────────────────
const commits = load('commits.json')
if (commits) {
  genAt(commits, 'commits.json')
  listShape(commits, 'commits', ['hash', 'repo', 'author', 'date', 'message'], 'commits.json')
  scopeUnion(commits.commits, 'commits.json.commits')
  // datas em UTC uniforme (o coletor normaliza; offset misto quebra a ordenação)
  // e ordem desc por timestamp real — a página de perfil assume isso
  const list = (isArr(commits.commits) ? commits.commits : []) as Record<string, unknown>[]
  let prev = Infinity
  let checked = 0
  let mergeLike = 0
  for (const c of list) {
    const d = String(c.date ?? '')
    if (!d.endsWith('Z')) {
      errors.push(`commits.json: data sem UTC uniforme ("${d}") — rode a coleta de novo`)
      break
    }
    const t = Date.parse(d)
    if (Number.isNaN(t)) {
      errors.push(`commits.json: data inválida ("${d}")`)
      break
    }
    if (t > prev) {
      errors.push(`commits.json: fora de ordem cronológica em "${c.hash}" (${d})`)
      break
    }
    prev = t
    if (!/^[0-9a-f]{7}$/.test(String(c.hash ?? ''))) {
      errors.push(`commits.json: hash fora do formato 7-hex ("${c.hash}")`)
      break
    }
    // commits de merge topológicos saem pelo --no-merges (decisão #7). Os que
    // sobram com assunto de merge são single-parent (squash/pull regravado) —
    // se têm diff zero, só inflam contagem: revisão manual (aviso, não bloqueia)
    if (/^Merge (?:branch|remote-tracking branch|pull request|refs\/)/.test(String(c.message ?? '')) && Number(c.additions) === 0 && Number(c.deletions) === 0)
      mergeLike++
    if (++checked >= 4000)
      break // amostra generosa — não precisa varrer tudo
  }
  if (mergeLike)
    warn(false, `commits.json: ${mergeLike} commits com assunto de merge e diff zero na amostra — single-parent (squash/pull regravado), candidate a excluir (decisão #7)`)
}

// ── github.json ───────────────────────────────────────────────────────────
const github = load('github.json')
if (github) {
  genAt(github, 'github.json')
  listShape(github, 'prs', ['repo', 'number', 'state', 'author'], 'github.json')
  if (!github.users || typeof github.users !== 'object' || Array.isArray(github.users)) {
    errors.push('github.json.users: esperado objeto login→{name,bot}')
  }
  else {
    const first = Object.values(github.users as Record<string, unknown>)[0] as Record<string, unknown> | undefined
    if (first && (typeof first.name !== 'string' || typeof first.bot !== 'boolean')) {
      errors.push('github.json.users[*]: esperado {name: string, bot: boolean}')
    }
  }
  // invariantes dos PRs: estado válido, mergedAt presente em MERGED, sem duplicados
  const seenPr = new Set<string>()
  // janela de mergeados (issue #5): nada com mergedAt mais velho que 400d +
  // folga de 1 dia (corte do script vs generatedAt) pode sobreviver na coleta
  const windowMs = Date.parse(String(github.generatedAt)) - 401 * 86_400_000
  let staleMerged = 0
  let oldestStale = ''
  for (const p of (isArr(github.prs) ? github.prs : []) as Record<string, unknown>[]) {
    if (p.state !== 'OPEN' && p.state !== 'MERGED') {
      errors.push(`github.prs ${p.repo}#${p.number}: state inesperado "${p.state}"`)
      break
    }
    if (p.state === 'MERGED' && (typeof p.mergedAt !== 'string' || Number.isNaN(Date.parse(p.mergedAt)))) {
      errors.push(`github.prs ${p.repo}#${p.number}: MERGED sem mergedAt válido`)
      break
    }
    if (p.state === 'MERGED' && typeof p.mergedAt === 'string' && Number.isFinite(windowMs) && Date.parse(p.mergedAt) < windowMs) {
      staleMerged++
      if (!oldestStale || p.mergedAt < oldestStale)
        oldestStale = p.mergedAt
    }
    // reviews: state precisa casar com a union fechada de PrReview.state (issue #42)
    // — o coletor repassa o valor da API sem validar
    for (const r of (isArr(p.reviews) ? p.reviews : []) as Record<string, unknown>[]) {
      if (!isPrReviewState(r.state)) {
        errors.push(`github.prs ${p.repo}#${p.number}: review state inesperado \"${String(r.state)}\"`)
        break
      }
    }
    const key = `${p.repo}#${p.number}`
    if (seenPr.has(key)) {
      errors.push(`github.prs: PR duplicado ${key}`)
      break
    }
    seenPr.add(key)
  }
  if (staleMerged)
    errors.push(`github.prs: ${staleMerged} MERGED fora da janela de 400d (mais antigo ${oldestStale}) — a coleta precisa podar por mergedAt`)
}

// ── releases.json ─────────────────────────────────────────────────────────
const releases = load('releases.json')
if (releases) {
  genAt(releases, 'releases.json')
  listShape(releases, 'repos', ['repo', 'url', 'tags', 'unreleased'], 'releases.json')
  // invariantes por repo: tags em ordem desc, contadores >= 0, cobertura total
  // (unreleased + Σcommits das tags == commits do repo no stats.json)
  for (const r of (isArr(releases.repos) ? releases.repos : []) as Record<string, unknown>[]) {
    const tags = (isArr(r.tags) ? r.tags : []) as Record<string, unknown>[]
    let prevT = Infinity
    let tagCommits = 0
    for (const t of tags) {
      const ms = Date.parse(String(t.date ?? ''))
      if (Number.isNaN(ms)) {
        errors.push(`releases["${r.repo}"]: tag "${t.tag}" com data inválida`)
        break
      }
      if (ms > prevT) {
        errors.push(`releases["${r.repo}"]: tags fora de ordem desc ("${t.tag}")`)
        break
      }
      prevT = ms
      if (Number(t.commits) < 0) {
        errors.push(`releases["${r.repo}"]: tag "${t.tag}" com commits negativos`)
        break
      }
      tagCommits += Number(t.commits) || 0
    }
    const unreleased = Number(r.unreleased)
    if (!Number.isFinite(unreleased) || unreleased < 0) {
      errors.push(`releases["${r.repo}"]: unreleased inválido`)
      continue
    }
    const expected = perRepoCommits.get(String(r.repo))
    if (expected != null && expected > 0 && unreleased + tagCommits !== expected)
      errors.push(`releases["${r.repo}"]: unreleased (${unreleased}) + commits em tags (${tagCommits}) != commits do repo (${expected})`)
  }
}

// ── team.json (shape + invariantes do 4º coletor) ─────────────────────────
const team = load('team.json')
if (team) {
  genAt(team, 'team.json')
  listShape(team, 'devs', ['name', 'bot', 'emails', 'githubLogins', 'teams'], 'team.json')
  listShape(team, 'teams', ['name', 'members'], 'team.json')
  listShape(team, 'candidates', ['kind', 'id'], 'team.json')

  const devs = (isArr(team.devs) ? team.devs : []) as Record<string, unknown>[]
  const names = new Set(devs.map(d => d.name))
  if (names.size !== devs.length)
    errors.push('team.json.devs: nomes duplicados')

  // membro de time precisa ser dev conhecido (senão badge/membro órfão na UI)
  if (isArr(team.teams)) {
    for (const t of team.teams as Record<string, unknown>[]) {
      for (const m of (isArr(t.members) ? t.members : []) as string[]) {
        if (!names.has(m))
          errors.push(`team.json.teams["${t.name}"]: membro "${m}" não é dev conhecido`)
      }
    }
  }

  // invariante M1: bot/ghost NUNCA vira candidato a mapear
  if (isArr(team.candidates)) {
    for (const c of team.candidates as Record<string, unknown>[]) {
      const id = String(c.id).toLowerCase()
      if (id === 'ghost')
        errors.push('team.json.candidates: "ghost" (PR apagado) não deveria ser candidato')
      if (/\[bot\]|-bot$|^dependabot/.test(id))
        errors.push(`team.json.candidates: bot "${c.id}" não deveria ser candidato`)
      if (c.kind !== 'login' && c.kind !== 'author')
        errors.push(`team.json.candidates: kind inesperado "${c.kind}"`)
    }
  }

  // logins sem duplicata por case dentro do mesmo dev (collect-team deduplica)
  for (const d of devs) {
    const seen = new Set<string>()
    for (const l of (isArr(d.githubLogins) ? d.githubLogins : []) as string[]) {
      const k = l.toLowerCase()
      if (seen.has(k)) {
        errors.push(`team.json.devs["${d.name}"]: login duplicado por case ("${l}")`)
        break
      }
      seen.add(k)
    }
  }

  // avisos de qualidade (não bloqueiam): identidade candidata já em um time
  // (mesma pessoa contada 2× nas métricas do time) e dev humano sem nenhum alias
  const candidateIds = new Set((isArr(team.candidates) ? team.candidates : []).map(c => String((c as Record<string, unknown>).id).toLowerCase()))
  if (isArr(team.teams)) {
    for (const t of team.teams as Record<string, unknown>[]) {
      for (const m of (isArr(t.members) ? t.members : []) as string[]) {
        warn(!candidateIds.has(m.toLowerCase()), `team.json.teams["${t.name}"]: membro "${m}" também está em "Sem mapeamento" — associar o alias unifica as métricas`)
      }
    }
  }
  for (const d of devs) {
    if (d.bot)
      continue
    const noAlias = (isArr(d.emails) ? d.emails : []).length === 0 && (isArr(d.githubLogins) ? d.githubLogins : []).length === 0
    warn(!noAlias, `team.json.devs["${d.name}"]: sem e-mails nem logins mapeados — identidade crua do git, revisar em /teams`)
  }
}

// ── veredito ──────────────────────────────────────────────────────────────
if (warnings.length) {
  console.warn(`\n⚠ check-data: ${warnings.length} aviso(s) de qualidade (não bloqueiam):`)
  for (const w of warnings) console.warn(`  - ${w}`)
}

if (errors.length) {
  console.error(`\n✗ check-data: ${errors.length} problema(s) em public/data/:`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log('✓ check-data: stats/commits/github/releases/team com shape e invariantes ok')
