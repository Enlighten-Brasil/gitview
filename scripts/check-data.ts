/**
 * Sanity check dos JSONs gerados pelos coletores — roda no fim do `pnpm collect`
 * (e como último passo do /__collect na UI). Não regenera nada: lê public/data/*
 * (mais o data/gitview.db quando existe — só para avisos, nunca para asserts)
 * e falha (exit 1) se o shape quebrar, antes de a UI estranhar os dados.
 *
 * ponytail: asserts de superfície (campos que os loaders/computed do src/ leem).
 * Quando um painel quebrar por dado novo, adiciona o campo aqui.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { validateReportCommitsData } from '../src/report-commits'
import { BRANCH_STATUSES, isBranchStatus, isProgressScope, isPrReviewState } from '../src/types'
import { initLog } from './lib/log'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')

initLog('check-data')

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
    check(sum(stats.weekly, 'commits') === totals.commits, `stats.json: Σweekly.commits (${sum(stats.weekly, 'commits')}) != totals.commits (${totals.commits})`)
    check(sum(stats.monthlyTypes, 'commits') === totals.commits, `stats.json: ΣmonthlyTypes.commits (${sum(stats.monthlyTypes, 'commits')}) != totals.commits (${totals.commits})`)
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
    // -----------------------------------------------------------------------
    // byScope (issue #152): eixos prod/progress com os mesmos campos medidos
    // da linha. Ausente = dado coletado antes da feature (feature-detect no
    // frontend — não é erro). Presente ⇒ union fechada: EXATAMENTE as chaves
    // 'prod' e 'progress' (a filosofia omit-prod rege o campo `scope` das
    // linhas, não as chaves do byScope — autor só-progress tem eixo prod
    // zerado). Invariantes: os aditivos (commits/additions/deletions) dos
    // dois eixos somam a linha; os não-aditivos têm teto na linha — dias
    // ativos/repos/longestStreak do eixo ≤ da linha (conjunto de dias/repos
    // do eixo é subconjunto dos da linha), streak do eixo ≤ longestStreak do
    // eixo (run é caso particular de recorde). ATENÇÃO: streak do eixo ≤
    // streak da linha NÃO vale em geral — o streak da linha é o run que
    // TERMINA no último dia ativo dela, que pode ser do outro eixo (dev cujo
    // commit mais recente é progress tem streak da linha 1 enquanto o eixo
    // prod guarda um run de 3 encerrado antes); o teto correto do streak do
    // eixo é o longestStreak da linha, coberto pela cadeia acima. lastCommit
    // do eixo ≤ da linha (comparação lexicográfica de ISO; eixo zerado = '').
    // -----------------------------------------------------------------------
    if (!('byScope' in a))
      continue
    const bs = a.byScope
    if (bs === null || typeof bs !== 'object' || Array.isArray(bs)) {
      errors.push(`stats.perAuthor["${a.author}"].byScope: esperado objeto, veio ${Array.isArray(bs) ? 'lista' : typeof bs}`)
      continue
    }
    const axisKeys = Object.keys(bs as Record<string, unknown>).sort().join(',')
    if (axisKeys !== 'prod,progress') {
      errors.push(`stats.perAuthor["${a.author}"].byScope: chaves inesperadas (${Object.keys(bs as Record<string, unknown>).map(k => `"${k}"`).join(', ')}) — union fechada, exatamente 'prod' e 'progress'`)
      continue
    }
    for (const axisName of ['prod', 'progress'] as const) {
      const ax = (bs as Record<string, Record<string, unknown>>)[axisName]
      const where = `stats.perAuthor["${a.author}"].byScope.${axisName}`
      if (ax === null || typeof ax !== 'object' || Array.isArray(ax)) {
        errors.push(`${where}: esperado objeto, veio ${Array.isArray(ax) ? 'lista' : typeof ax}`)
        continue
      }
      for (const f of ['commits', 'additions', 'deletions', 'repos', 'activeDays', 'streak', 'longestStreak'] as const) {
        if (typeof ax[f] !== 'number' || !Number.isFinite(ax[f] as number))
          errors.push(`${where}.${f}: esperado número, veio ${JSON.stringify(ax[f])}`)
        else if ((ax[f] as number) < 0)
          errors.push(`${where}: contagem negativa (${f} = ${ax[f]})`)
      }
      if (typeof ax.lastCommit !== 'string')
        errors.push(`${where}.lastCommit: esperado string ISO ('' no eixo zerado), veio ${JSON.stringify(ax.lastCommit)}`)
      else if (ax.lastCommit !== '' && Number.isNaN(Date.parse(ax.lastCommit)))
        errors.push(`${where}.lastCommit: data inválida ("${ax.lastCommit}")`)
    }
    const prodAx = (bs as Record<string, Record<string, number>>).prod
    const progAx = (bs as Record<string, Record<string, number>>).progress
    if (typeof prodAx !== 'object' || prodAx === null || typeof progAx !== 'object' || progAx === null)
      continue // shape já reportado acima
    for (const f of ['commits', 'additions', 'deletions'] as const) {
      check(
        Number(prodAx[f]) + Number(progAx[f]) === Number(a[f]),
        `stats.perAuthor["${a.author}"]: byScope.prod.${f} (${prodAx[f]}) + byScope.progress.${f} (${progAx[f]}) != ${f} da linha (${a[f]})`,
      )
    }
    for (const axisName of ['prod', 'progress'] as const) {
      const ax = (bs as Record<string, Record<string, unknown>>)[axisName]
      const where = `stats.perAuthor["${a.author}"].byScope.${axisName}`
      check(Number(ax.activeDays) <= Number(a.activeDays), `${where}.activeDays (${ax.activeDays}) > activeDays da linha (${a.activeDays}) — eixo não pode exceder o todo`)
      check(Number(ax.repos) <= Number(a.repos), `${where}.repos (${ax.repos}) > repos da linha (${a.repos}) — eixo não pode exceder o todo`)
      check(Number(ax.longestStreak) <= Number(a.longestStreak), `${where}.longestStreak (${ax.longestStreak}) > longestStreak da linha (${a.longestStreak}) — eixo não pode exceder o todo`)
      check(Number(ax.streak) <= Number(ax.longestStreak), `${where}.streak (${ax.streak}) > longestStreak do eixo (${ax.longestStreak}) — run atual excede o próprio recorde`)
      check(String(ax.lastCommit) <= String(a.lastCommit), `${where}.lastCommit ("${ax.lastCommit}") > lastCommit da linha ("${a.lastCommit}") — eixo não pode exceder o todo`)
    }
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
    if (++checked >= 4000)
      break // amostra generosa — não precisa varrer tudo
  }
  // hash único por (repo, hash) — a chave da linha: o mesmo commit pode
  // existir em repos irmãos com história compartilhada (unicidade global
  // quebraria o gate); duplicata dentro do repo = linha inserida 2×
  const seenHash = new Set<string>()
  for (let i = 0; i < list.length; i++) {
    const c = list[i]
    const key = JSON.stringify([c.repo, c.hash])
    if (seenHash.has(key)) {
      errors.push(`commits.json: hash "${String(c.hash)}" duplicado no repo "${String(c.repo)}" (commits[${i}])`)
      break
    }
    seenHash.add(key)
  }
}

// ── data/gitview.db (opcional — CI-safe, issue #204) ─────────────────────
// O aviso de merge-subject + diff zero precisa do banco (gitignored): a
// leitura é CONDICIONAL à existência do arquivo — com o banco roda e avisa;
// sem ele (CI) loga a linha de não avaliado e segue verde. Os asserts acima
// continuam lendo APENAS os JSONs de public/data.
const DB_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'gitview.db')
if (existsSync(DB_PATH)) {
  // merges topológicos saem pelo --no-merges (decisão #7): o que resta com
  // assunto de merge é squash/pull regravado OU merge topológico legado de
  // banco antigo (a tabela não guarda parents — sem como verificar aqui) —
  // com diff zero, só infla a contagem
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(DB_PATH, { readOnly: true })
  const dbTotal = (db.prepare('SELECT COUNT(*) AS n FROM commits').get() as { n: number }).n
  const dbRows = db.prepare('SELECT hash, subject FROM commits WHERE additions = 0 AND deletions = 0 AND subject LIKE ?').all('Merge %') as { hash: string, subject: string }[]
  db.close()
  const mergeLike = dbRows.filter(r => /^Merge (?:branch|remote-tracking branch|pull request|refs\/)/.test(r.subject))
  // decisão baked (#204): AVISAR e manter a contagem (3 de 21.311 — o custo
  // de um filtro retroativo não compensa); reverter se discordar
  warn(mergeLike.length === 0, `data/gitview.db: ${mergeLike.length} de ${dbTotal} commits com assunto de merge e diff +0/-0 (${mergeLike.map(r => r.hash.slice(0, 8)).join(', ')}) — revisar manualmente; manter a contagem (decisão baked)`)
}
else {
  console.log('○ check-data: data/gitview.db ausente (gitignored) — aviso de merge-subject + diff +0/-0 não avaliado (CI-safe)')
}

// ── daily.json (7º fixo — agregado dia-preciso, issue #175) ───────────────
const daily = load('daily.json')
if (daily) {
  genAt(daily, 'daily.json')
  // vínculo de snapshot do anexo (#288): os três JSONs do anexo saem da mesma
  // coleta com o MESMO generatedAt — divergência bloqueia exportação/impressão
  if (stats && daily.generatedAt !== stats.generatedAt)
    errors.push(`daily.json.generatedAt (${JSON.stringify(daily.generatedAt)}) != stats.json.generatedAt (${JSON.stringify(stats.generatedAt)})`)
  listShape(daily, 'daily', ['day', 'repo', 'author', 'commits', 'additions', 'deletions', 'weekend', 'night'], 'daily.json')
  scopeUnion(daily.daily, 'daily.json.daily')
  const drows = (isArr(daily.daily) ? daily.daily : []) as Record<string, unknown>[]
  for (const dr of drows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dr.day))) {
      errors.push(`daily.json: day fora do formato YYYY-MM-DD ("${String(dr.day)}")`)
      break
    }
  }
  // invariantes contra stats.json (as duas listas já foram carregadas): o corte
  // dia-preciso reproduz as contagens do totals por construção (mesmas linhas,
  // mesmos skips) e os predicados de weekend/night são os do weekly — a soma
  // cross-file fecha. Ausente/quebrado no stats o erro já sai do próprio stats.
  const dsum = (f: (r: Record<string, unknown>) => boolean, key: string) => drows.filter(f).reduce((s, r) => s + (Number(r[key]) || 0), 0)
  const st = (stats?.totals ?? {}) as Record<string, unknown>
  if (typeof st.commits === 'number') {
    const dCommits = dsum(() => true, 'commits')
    check(dCommits === st.commits, `daily.json: Σdaily.commits (${dCommits}) != totals.commits (${st.commits})`)
    const dProd = dsum(r => !('scope' in r), 'commits')
    check(dProd === st.prodCommits, `daily.json: Σdaily.commits sem scope (${dProd}) != totals.prodCommits (${st.prodCommits})`)
    const dProgress = dsum(r => 'scope' in r, 'commits')
    check(dProgress === st.progressCommits, `daily.json: Σdaily.commits com scope (${dProgress}) != totals.progressCommits (${st.progressCommits})`)
    const dAdd = dsum(() => true, 'additions')
    check(dAdd === st.additions, `daily.json: Σadditions (${dAdd}) != totals.additions (${st.additions})`)
    const dDel = dsum(() => true, 'deletions')
    check(dDel === st.deletions, `daily.json: Σdeletions (${dDel}) != totals.deletions (${st.deletions})`)
    const wsum = (key: string) => (isArr(stats?.weekly) ? (stats!.weekly as Record<string, unknown>[]) : []).reduce((s, r) => s + (Number(r[key]) || 0), 0)
    const dWeekend = dsum(() => true, 'weekend')
    check(dWeekend === wsum('weekend'), `daily.json: Σdaily.weekend (${dWeekend}) != Σweekly.weekend (${wsum('weekend')})`)
    const dNight = dsum(() => true, 'night')
    check(dNight === wsum('night'), `daily.json: Σdaily.night (${dNight}) != Σweekly.night (${wsum('night')})`)
    // aviso (não bloqueante): dia canônico do daily == dias ativos do totals
    const dDays = new Set(drows.map(r => String(r.day))).size
    warn(dDays === st.activeDays, `daily.json: ${dDays} dias distintos != totals.activeDays (${st.activeDays}) — o dia do agregado divergiu do fuso canônico (slice de data em UTC? dayKeyOf ausente na coleta)`)
  }
}

// ── report-commits.json (8º fixo — histórico completo lazy, issue #287) ────
const reportCommits = load('report-commits.json')
if (reportCommits)
  errors.push(...validateReportCommitsData(reportCommits, { daily, stats }))

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
  // cross-file (#204): author de PR mapeado em users (ghost = PR apagado,
  // isento) e repo de PR existente no stats.json. Presença estrutural, não
  // cardinalidade: lista vazia mantém o assert ativo (Codacy review) —
  // ausente = sem o que comparar; vazia = tudo referenciado é órfão
  const ghUsers = github.users && typeof github.users === 'object' && !Array.isArray(github.users)
    ? new Set(Object.keys(github.users as Record<string, unknown>))
    : null
  const ghStatsRepos = isArr(stats?.repos) ? new Set(stats!.repos as string[]) : null
  // invariantes dos PRs: estado válido, mergedAt presente em MERGED, sem duplicados
  const seenPr = new Set<string>()
  // janela de mergeados (issue #5): nada com mergedAt mais velho que 400d +
  // folga de 1 dia (corte do script vs generatedAt) pode sobreviver na coleta
  const windowMs = Date.parse(String(github.generatedAt)) - 401 * 86_400_000
  let staleMerged = 0
  let oldestStale = ''
  for (const p of (isArr(github.prs) ? github.prs : []) as Record<string, unknown>[]) {
    if (ghUsers && String(p.author) !== 'ghost' && !ghUsers.has(String(p.author)))
      errors.push(`github.prs ${p.repo}#${p.number}: author "${String(p.author)}" ausente do github.json.users (ghost isento)`)
    if (ghStatsRepos && !ghStatsRepos.has(String(p.repo)))
      errors.push(`github.prs ${p.repo}#${p.number}: repo ausente do stats.json#repos — descoberta/config divergente entre coletores`)
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
    let prevSumMs = NaN
    let groupCount = 0
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
      // tags irmãs (mesmo instante) dividem o count do grupo — soma uma vez;
      // counts divergentes no mesmo instante são dado inconsistente: a dedup
      // silenciosa somaria errado, então erroa (Codacy review)
      if (ms !== prevSumMs) {
        tagCommits += Number(t.commits) || 0
        groupCount = Number(t.commits) || 0
      }
      else if ((Number(t.commits) || 0) !== groupCount) {
        errors.push(`releases["${r.repo}"]: tags do mesmo instante com counts divergentes ("${t.tag}" = ${t.commits}, esperado ${groupCount})`)
      }
      prevSumMs = ms
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

  // #204 — bloco novo DEPOIS do loop de cobertura (a soma tagCommits e o if
  // de cobertura acima são da #193 em paralelo, não editar)
  const releasesStatsRepos = isArr(stats?.repos) ? new Set(stats!.repos as string[]) : null
  const zeroTagRepos = new Map<string, number>()
  for (const r of (isArr(releases.repos) ? releases.repos : []) as Record<string, unknown>[]) {
    const repo = String(r.repo)
    if (releasesStatsRepos && !releasesStatsRepos.has(repo))
      errors.push(`releases.repos["${repo}"]: repo ausente do stats.json#repos — descoberta/config divergente entre coletores`)
    const tags = isArr(r.tags) ? (r.tags as Record<string, unknown>[]) : []
    // a PRIMEIRA tag do repo (a mais antiga — a lista é desc) é isenta: pode
    // nascer antes do 1º commit e ter 0 legítimo; as irmãs no mesmo commit
    // caem aqui até a #193 corrigir a contagem
    for (let i = 0; i < tags.length - 1; i++) {
      if (Number(tags[i].commits) === 0)
        zeroTagRepos.set(repo, (zeroTagRepos.get(repo) ?? 0) + 1)
    }
  }
  const zeroTotal = [...zeroTagRepos.values()].reduce((s, n) => s + n, 0)
  const zeroByRepo = [...zeroTagRepos].map(([repo, n]) => `${repo} ${n}`).join(', ')
  warn(zeroTotal === 0, `releases.json: ${zeroTotal} tag(s) com commits=0 além da primeira do repo (${zeroByRepo}) — release vazio/duplicado?`)
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

  // nomes que colidem só pelo sufixo de bot ('x' e 'x[bot]') são a MESMA
  // identidade — collect-team canonicaliza sem o sufixo; par sobrevivente = bug
  const normKeys = new Map<string, string>()
  for (const d of devs) {
    const k = String(d.name).replace(/\[bot\]$/i, '').toLowerCase()
    const twin = normKeys.get(k)
    if (twin !== undefined)
      errors.push(`team.json.devs: "${d.name}" duplica "${twin}" após normalizar sufixo de bot`)
    else
      normKeys.set(k, String(d.name))
  }

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

// ── branches.json (6º JSON — inventário de branches, issue #123) ──────────
const branches = load('branches.json')
if (branches) {
  genAt(branches, 'branches.json')
  listShape(branches, 'repos', ['repo', 'productionRef', 'integrationRefs', 'branches'], 'branches.json')
  // repo do branches.json precisa existir no stats.json (mesma descoberta de repos)
  const statsRepos = new Set(isArr(stats?.repos) ? (stats!.repos as string[]) : [])
  const nowMs = Date.now()
  for (const r of (isArr(branches.repos) ? branches.repos : []) as Record<string, unknown>[]) {
    const where = `branches.repos["${String(r.repo)}"]`
    if (statsRepos.size > 0 && !statsRepos.has(String(r.repo)))
      errors.push(`${where}: repo ausente do stats.json#repos — descoberta/config divergente entre coletores`)
    if (typeof r.productionRef !== 'string' || !r.productionRef)
      errors.push(`${where}.productionRef: esperado string não vazia`)
    if (!isArr(r.integrationRefs) || !r.integrationRefs.every(x => typeof x === 'string')) {
      errors.push(`${where}.integrationRefs: esperado lista de strings`)
    }
    else if (r.integrationRefs.length === 0) {
      // repo sem develop/staging é legítimo (seam lib/refs.ts) — só vale aviso
      warn(false, `${where}: sem ref de integração (develop?) — aheadInt/behindInt nulos neste repo`)
    }
    if (!isArr(r.branches)) {
      errors.push(`${where}.branches: esperado lista`)
      continue
    }
    const seen = new Set<string>()
    let prodCount = 0
    let prodName = ''
    for (const b of r.branches as Record<string, unknown>[]) {
      const bw = `${where}.branches["${String(b.name)}"]`
      const name = typeof b.name === 'string' ? b.name : ''
      if (!name) {
        errors.push(`${where}.branches: entrada sem nome`)
        continue
      }
      if (seen.has(name)) {
        errors.push(`${where}.branches: nome duplicado "${name}"`)
        break
      }
      seen.add(name)
      if (!isBranchStatus(b.status))
        errors.push(`${bw}.status: inesperado "${String(b.status)}" — union fechada (${BRANCH_STATUSES.join(', ')})`)
      if (!/^[0-9a-f]{7,40}$/.test(String(b.tip ?? '')))
        errors.push(`${bw}.tip: fora do formato 7-40 hex ("${String(b.tip)}")`)
      for (const f of ['aheadProd', 'behindProd', 'additions', 'deletions'] as const) {
        if (typeof b[f] !== 'number' || !Number.isInteger(b[f]) || Number(b[f]) < 0)
          errors.push(`${bw}.${f}: esperado inteiro >= 0, veio ${JSON.stringify(b[f])}`)
      }
      // nullable por design: repo sem ref de integração viaja null (nunca 0 falso)
      for (const f of ['aheadInt', 'behindInt'] as const) {
        const v = b[f]
        if (v !== null && (typeof v !== 'number' || !Number.isInteger(v) || v < 0))
          errors.push(`${bw}.${f}: esperado inteiro >= 0 ou null (repo sem ref de integração), veio ${JSON.stringify(v)}`)
      }
      // e-mail CRU (%ae) por design (desvio do padrão canônico — fato puramente git)
      if (!isArr(b.authorsAhead) || !b.authorsAhead.every(e => typeof e === 'string' && e.includes('@')))
        errors.push(`${bw}.authorsAhead: esperado lista de e-mails crus (strings com "@")`)
      const t = Date.parse(String(b.lastActivity ?? ''))
      if (Number.isNaN(t)) {
        errors.push(`${bw}.lastActivity: data inválida ("${String(b.lastActivity)}")`)
      }
      else {
        warn(t <= nowMs + 86_400_000, `${bw}.lastActivity no futuro (${String(b.lastActivity)}) — relógio do autor errado?`)
      }
      if (b.status === 'production') {
        prodCount++
        prodName = name
      }
    }
    // exatamente 1 branch production por repo, com nome == productionRef do próprio JSON
    if (prodCount !== 1) {
      errors.push(`${where}: ${prodCount} branches com status "production" — esperado exatamente 1`)
    }
    else if (prodName !== r.productionRef) {
      errors.push(`${where}: branch production "${prodName}" != productionRef "${String(r.productionRef)}"`)
    }
  }
}

// ── graph-*.json (topologia por repo, issue #126 — UM arquivo por repo) ────
// A recoleta light não roda o collect-graph (não escaneia git): valida só os
// arquivos PRESENTES, e repo do stats.json SEM graph-*.json é AVISO, não erro
// (usuário incremental só terá o arquivo após recoletar; a UI mostra
// empty-state). Invariantes por arquivo: hash/parents 40-hex completos (o
// renderer indexa hash→linha), date UTC ISO com ms, author não vazio, ordem
// descendente por timestamp e sem hash duplicado.
const HASH40_RE = /^[0-9a-f]{40}$/
const ISO_MS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
const statsReposForGraph = new Set(isArr(stats?.repos) ? (stats!.repos as string[]) : [])
const graphRepos = new Set<string>()
if (existsSync(DATA_DIR)) {
  for (const file of readdirSync(DATA_DIR).sort()) {
    const nameMatch = file.match(/^graph-(.+)\.json$/)
    if (!nameMatch)
      continue
    const repoName = nameMatch[1]
    graphRepos.add(repoName)
    let data: Record<string, unknown>
    try {
      const parsed = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf-8'))
      if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        errors.push(`${file}: esperado objeto no topo`)
        continue
      }
      data = parsed as Record<string, unknown>
    }
    catch (err) {
      errors.push(`${file}: JSON inválido (${(err as Error).message})`)
      continue
    }
    genAt(data, file)
    if (data.repo !== repoName)
      errors.push(`${file}: repo "${String(data.repo)}" != nome do arquivo ("${repoName}")`)
    if (typeof data.window !== 'number' || !Number.isInteger(data.window) || data.window <= 0)
      errors.push(`${file}.window: esperado inteiro > 0, veio ${JSON.stringify(data.window)}`)
    if (!isArr(data.commits)) {
      errors.push(`${file}.commits: esperado lista`)
      continue
    }
    const rows = data.commits as Record<string, unknown>[]
    if (typeof data.window === 'number' && Number.isInteger(data.window) && rows.length > data.window)
      errors.push(`${file}: ${rows.length} commits acima da janela declarada (${data.window})`)
    if (statsReposForGraph.size > 0 && !statsReposForGraph.has(repoName))
      warn(false, `${file}: repo "${repoName}" ausente do stats.json#repos — arquivo órfão (repo saiu da seleção? \`pnpm clean\` remove)`)
    const seen = new Set<string>()
    let prev = Infinity
    for (let i = 0; i < rows.length; i++) {
      const c = rows[i]
      const cw = `${file}.commits[${i}]`
      const hash = typeof c.hash === 'string' ? c.hash : ''
      if (!HASH40_RE.test(hash)) {
        errors.push(`${cw}.hash: fora do formato 40-hex ("${String(c.hash).slice(0, 50)}")`)
        break
      }
      if (seen.has(hash)) {
        errors.push(`${file}: hash duplicado "${hash}" (commits[${i}])`)
        break
      }
      seen.add(hash)
      if (!isArr(c.parents) || !c.parents.every(p => typeof p === 'string' && HASH40_RE.test(p))) {
        errors.push(`${cw}.parents: esperado lista de 40-hex (vazia na raiz, 2+ em merge), veio ${JSON.stringify(c.parents)?.slice(0, 80)}`)
        break
      }
      if (typeof c.author !== 'string' || !c.author.trim()) {
        errors.push(`${cw}.author: vazio ou ausente`)
        break
      }
      const d = typeof c.date === 'string' ? c.date : ''
      if (!ISO_MS_RE.test(d) || Number.isNaN(Date.parse(d))) {
        errors.push(`${cw}.date: fora do formato UTC ISO com ms ("${String(c.date).slice(0, 40)}")`)
        break
      }
      if (typeof c.subject !== 'string') {
        errors.push(`${cw}.subject: esperado string`)
        break
      }
      if (!isArr(c.refs) || !c.refs.every(r => typeof r === 'string')) {
        errors.push(`${cw}.refs: esperado lista de strings (itens de decoration do %D)`)
        break
      }
      const t = Date.parse(d)
      if (t > prev) {
        errors.push(`${file}: fora de ordem descendente em "${hash}" (${d})`)
        break
      }
      prev = t
    }
  }
}
// repo do stats SEM graph-*.json = aviso (não erro): só a coleta completa gera
if (stats && isArr(stats.repos)) {
  for (const r of stats.repos as string[]) {
    warn(graphRepos.has(String(r)), `graph-${String(r)}.json: ausente para repo do stats.json — rode a coleta completa (a light não gera; a UI mostra empty-state)`)
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

console.log('✓ check-data: stats/daily/commits/report-commits/github/releases/team/branches + graph-*.json com shape e invariantes ok')
