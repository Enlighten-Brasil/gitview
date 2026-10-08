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
import { fileURLToPath } from 'node:url'

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data')

const errors: string[] = []

function check(cond: boolean, msg: string): void {
  if (!cond) errors.push(msg)
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
    if (!allowEmpty) errors.push(`${where}.${key}: lista vazia`)
    return
  }
  const first = v[0]
  if (typeof first !== 'object' || first === null) {
    errors.push(`${where}.${key}[0]: esperado objeto, veio ${typeof first}`)
    return
  }
  for (const f of fields) {
    if (!(f in (first as Record<string, unknown>))) errors.push(`${where}.${key}[0]: campo ausente "${f}"`)
  }
}

function genAt(data: Record<string, unknown>, where: string): void {
  const g = data.generatedAt
  if (typeof g !== 'string' || Number.isNaN(Date.parse(g))) errors.push(`${where}.generatedAt: ISO inválido`)
}

/** lista de strings (ex.: stats.repos) */
function stringList(data: Record<string, unknown>, key: string, where: string): void {
  const v = data[key]
  if (!isArr(v) || !v.every(x => typeof x === 'string')) errors.push(`${where}.${key}: esperado lista de strings`)
}

// ── stats.json ────────────────────────────────────────────────────────────
const stats = load('stats.json')
if (stats) {
  genAt(stats, 'stats.json')
  stringList(stats, 'repos', 'stats.json')
  listShape(stats, 'authors', ['name', 'emails', 'bot'], 'stats.json')
  listShape(stats, 'perRepo', ['repo', 'commits'], 'stats.json')
  listShape(stats, 'perAuthor', ['author', 'commits'], 'stats.json')
  listShape(stats, 'weekly', ['week', 'commits'], 'stats.json')
  listShape(stats, 'monthly', ['month', 'commits'], 'stats.json')
  listShape(stats, 'heatmap', ['author', 'weekday', 'hour', 'commits'], 'stats.json')
  listShape(stats, 'monthlyTypes', ['month', 'type', 'commits'], 'stats.json')
  if (!stats.repoUrls || typeof stats.repoUrls !== 'object') errors.push('stats.json.repoUrls: esperado objeto')
  // commits por autor somam >= 0 e authors tem flag bot booleana
  if (isArr(stats.authors)) {
    for (const a of stats.authors as Record<string, unknown>[]) {
      if (typeof a.bot !== 'boolean') { errors.push(`stats.authors["${a.name}"].bot: não booleano`); break }
    }
  }
}

// ── commits.json ──────────────────────────────────────────────────────────
const commits = load('commits.json')
if (commits) {
  genAt(commits, 'commits.json')
  listShape(commits, 'commits', ['hash', 'repo', 'author', 'date', 'message'], 'commits.json')
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
}

// ── releases.json ─────────────────────────────────────────────────────────
const releases = load('releases.json')
if (releases) {
  genAt(releases, 'releases.json')
  listShape(releases, 'repos', ['repo', 'url', 'tags', 'unreleased'], 'releases.json')
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
  if (names.size !== devs.length) errors.push('team.json.devs: nomes duplicados')

  // membro de time precisa ser dev conhecido (senão badge/membro órfão na UI)
  if (isArr(team.teams)) {
    for (const t of team.teams as Record<string, unknown>[]) {
      for (const m of (isArr(t.members) ? t.members : []) as string[]) {
        if (!names.has(m)) errors.push(`team.json.teams["${t.name}"]: membro "${m}" não é dev conhecido`)
      }
    }
  }

  // invariante M1: bot/ghost NUNCA vira candidato a mapear
  if (isArr(team.candidates)) {
    for (const c of team.candidates as Record<string, unknown>[]) {
      const id = String(c.id).toLowerCase()
      if (id === 'ghost') errors.push('team.json.candidates: "ghost" (PR apagado) não deveria ser candidato')
      if (/(?:\[bot\]|-bot$|^dependabot)/.test(id)) errors.push(`team.json.candidates: bot "${c.id}" não deveria ser candidato`)
      if (c.kind !== 'login' && c.kind !== 'author') errors.push(`team.json.candidates: kind inesperado "${c.kind}"`)
    }
  }
}

// ── veredito ──────────────────────────────────────────────────────────────
if (errors.length) {
  console.error(`\n✗ check-data: ${errors.length} problema(s) em public/data/:`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log('✓ check-data: stats/commits/github/releases/team com shape ok')
