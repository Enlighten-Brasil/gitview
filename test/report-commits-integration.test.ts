import type { SpawnSyncReturns } from 'node:child_process'
import type { CommitRow, DailyRow, ReportCommitsData, Stats } from '../src/types'
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { compareReportCommitRows, validateReportCommitsData } from '../src/report-commits'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TSX_CLI = createRequire(import.meta.url).resolve('tsx/cli')
const temps: string[] = []

function makeProject(): string {
  const project = mkdtempSync(join(tmpdir(), 'gitview-report-commits-'))
  temps.push(project)
  cpSync(join(ROOT, 'scripts'), join(project, 'scripts'), { recursive: true })
  cpSync(join(ROOT, 'src'), join(project, 'src'), { recursive: true })
  cpSync(join(ROOT, '.env.example'), join(project, '.env.example'))
  cpSync(join(ROOT, 'package.json'), join(project, 'package.json'))
  return project
}

function runTsx(project: string, script: string, args: string[] = [], extraEnv: NodeJS.ProcessEnv = {}): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [TSX_CLI, join(project, 'scripts', script), ...args], {
    cwd: project,
    env: { ...process.env, ...extraEnv },
    encoding: 'utf-8',
    timeout: 60_000,
  })
}

function output(result: SpawnSyncReturns<string>): string {
  return `${result.stdout}\n${result.stderr}\n${result.error?.message ?? ''}`
}

function expectOk(result: SpawnSyncReturns<string>): void {
  expect(result.status, output(result)).toBe(0)
}

function expectReaggregateSkips(result: SpawnSyncReturns<string>): void {
  expectOk(result)
  const text = output(result)
  expect(text).toContain('Modo: reagregação')
  for (const marker of ['lendo histórico', 'Classificando commits', 'Expurgo:', 'git fetch'])
    expect(text).not.toContain(marker)
}

function readJson<T>(project: string, name: string): T {
  return JSON.parse(readFileSync(join(project, 'public', 'data', name), 'utf-8')) as T
}

function git(repo: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf-8',
    env: { ...process.env, ...env },
  }).trim()
}

function syntheticCommit(repo: string, file: string, content: string, subject: string, date: string, name: string, email: string): void {
  writeFileSync(join(repo, file), content)
  git(repo, ['add', file])
  git(repo, ['commit', '-m', subject], {
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email,
    GIT_AUTHOR_DATE: date,
    GIT_COMMITTER_DATE: date,
  })
}

function collectorEnv(project: string, reposRoot: string, machineTz = 'UTC'): NodeJS.ProcessEnv {
  return {
    GITVIEW_REPOS_ROOT: reposRoot,
    GITVIEW_TIMEZONE: 'America/Sao_Paulo',
    GITVIEW_PRODUCTION_REF: 'main',
    GITVIEW_INTEGRATION_REFS: 'develop',
    TZ: machineTz,
  }
}

afterAll(() => {
  for (const temp of temps)
    rmSync(temp, { recursive: true, force: true })
})

describe('integração do histórico completo de commits', () => {
  it('emite o log completo na coleta com aliases, escopos e dia canônico', () => {
    const project = makeProject()
    const reposRoot = join(project, 'repos')
    const repo = join(reposRoot, 'demo-api')
    mkdirSync(repo, { recursive: true })
    execFileSync('git', ['init', '-b', 'main', repo], { encoding: 'utf-8' })
    git(repo, ['config', 'user.name', 'Fixture'])
    git(repo, ['config', 'user.email', 'fixture@example.test'])
    git(repo, ['remote', 'add', 'origin', 'https://github.com/example/demo-api.git'])
    writeFileSync(join(project, 'team.local.json'), JSON.stringify({
      devProfiles: {
        Ana: { emails: ['ana-alias@example.test'] },
        Beto: { emails: ['beto@example.test'] },
      },
    }))

    syntheticCommit(repo, 'base.txt', 'um\n', 'chore: histórico antigo', '2020-01-01T12:00:00Z', 'Nome Cru', 'ana-alias@example.test')
    syntheticCommit(repo, 'base.txt', 'um\ndois\n', 'feat: produção sintética', '2026-10-16T01:00:00Z', 'Nome Cru', 'ana-alias@example.test')
    syntheticCommit(repo, 'bot.txt', 'bot\n', 'chore: bot sintético', '2026-10-16T01:00:00Z', 'robot[bot]', 'robot@example.test')
    git(repo, ['checkout', '-b', 'develop'])
    syntheticCommit(repo, 'develop.txt', 'integração\n', 'feat: integração sintética', '2026-10-16T01:00:00Z', 'Beto Cru', 'beto@example.test')
    git(repo, ['checkout', 'main'])
    git(repo, ['checkout', '-b', 'feat/sintetica'])
    syntheticCommit(repo, 'feature.txt', 'branch\n', 'feat: branch sintética', '2026-10-16T01:00:00Z', 'Nome Cru', 'ana-alias@example.test')

    expectOk(runTsx(project, 'collect.ts', [], collectorEnv(project, reposRoot)))

    const report = readJson<ReportCommitsData>(project, 'report-commits.json')
    const legacy = readJson<{ generatedAt: string, commits: CommitRow[] }>(project, 'commits.json')
    const stats = readJson<Stats>(project, 'stats.json')
    const daily = readJson<{ daily: DailyRow[] }>(project, 'daily.json')
    expect(report.generatedAt).toBe(stats.generatedAt)
    expect(report.commits).toHaveLength(5)
    expect(validateReportCommitsData(report, { stats, daily })).toEqual([])
    expect(report.commits.map(row => row.hash)).toEqual([...report.commits].sort(compareReportCommitRows).map(row => row.hash))
    expect(report.commits.every(row => /^[0-9a-f]{40}$/.test(row.hash))).toBe(true)
    expect(report.commits.filter(row => row.date === '2026-10-16T01:00:00.000Z').every(row => row.day === '2026-10-15')).toBe(true)
    expect(report.commits.find(row => row.message === 'chore: histórico antigo')?.day).toBe('2020-01-01')
    expect(report.commits.filter(row => row.author === 'Ana')).toHaveLength(3)
    expect(report.commits.filter(row => row.author === 'robot[bot]')).toHaveLength(1)
    expect(report.commits.filter(row => !row.scope)).toHaveLength(3)
    expect(report.commits.filter(row => row.scope === 'integration')).toHaveLength(1)
    expect(report.commits.filter(row => row.scope === 'branch')).toHaveLength(1)
    expect(legacy.commits).toHaveLength(5)
    expect(legacy.commits.every(row => /^[0-9a-f]{7}$/.test(row.hash))).toBe(true)
    expect(stats.repoUrls?.['demo-api']).toBe('https://github.com/example/demo-api')

    git(repo, ['checkout', 'main'])
    syntheticCommit(repo, 'incremental.txt', 'incremental\n', 'fix: incremental sintético', '2026-10-17T01:00:00Z', 'Nome Cru', 'ana-alias@example.test')
    expectOk(runTsx(project, 'collect.ts', [], collectorEnv(project, reposRoot)))
    const incremental = readJson<ReportCommitsData>(project, 'report-commits.json')
    expect(incremental.commits).toHaveLength(6)
    expect(incremental.commits.some(row => row.message === 'fix: incremental sintético')).toBe(true)
    expect(validateReportCommitsData(incremental, {
      stats: readJson<Stats>(project, 'stats.json'),
      daily: readJson<{ daily: DailyRow[] }>(project, 'daily.json'),
    })).toEqual([])

    expectOk(runTsx(project, 'collect.ts', ['--full'], collectorEnv(project, reposRoot)))
    const full = readJson<ReportCommitsData>(project, 'report-commits.json')
    expect(full.commits.map(row => row.hash)).toEqual(incremental.commits.map(row => row.hash))
    expect(new Set(full.commits.map(row => `${row.repo}:${row.hash}`)).size).toBe(6)
    expect(validateReportCommitsData(full, {
      stats: readJson<Stats>(project, 'stats.json'),
      daily: readJson<{ daily: DailyRow[] }>(project, 'daily.json'),
    })).toEqual([])
  }, 60_000)

  it('reagrega 101 commits sem perder o antigo nem alterar o corte de 100 por autor', () => {
    const project = makeProject()
    const reposRoot = join(project, 'repos')
    mkdirSync(join(reposRoot, 'demo-api', '.git'), { recursive: true })
    mkdirSync(join(project, 'data'), { recursive: true })
    const db = new DatabaseSync(join(project, 'data', 'gitview.db'))
    db.exec(`CREATE TABLE commits (
      repo TEXT NOT NULL, hash TEXT NOT NULL, author TEXT NOT NULL, email TEXT NOT NULL,
      date TEXT NOT NULL, subject TEXT NOT NULL, additions INTEGER NOT NULL DEFAULT 0,
      deletions INTEGER NOT NULL DEFAULT 0, scope TEXT, ref_hint TEXT,
      PRIMARY KEY (repo, hash)
    )`)
    const insert = db.prepare('INSERT INTO commits (repo, hash, author, email, date, subject, additions, deletions, scope, ref_hint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
    db.exec('BEGIN')
    for (let i = 0; i < 101; i++) {
      const recent = i < 100
      insert.run(
        'demo-api',
        i.toString(16).padStart(40, '0'),
        'Nome Cru',
        'ana-alias@example.test',
        recent ? '2026-10-16T01:00:00.000Z' : '2020-01-01T12:00:00.000Z',
        `test: commit sintético ${i}`,
        i % 4,
        i % 2,
        ['prod', 'integration', 'branch'][i % 3],
      )
    }
    db.exec('COMMIT')
    db.close()
    const teamPath = join(project, 'team.local.json')
    writeFileSync(teamPath, JSON.stringify({ devProfiles: { Ana: { emails: ['ana-alias@example.test'] } } }))

    expectReaggregateSkips(runTsx(project, 'collect.ts', ['--reaggregate'], collectorEnv(project, reposRoot)))
    const first = readJson<ReportCommitsData>(project, 'report-commits.json')
    const legacy = readJson<{ commits: CommitRow[] }>(project, 'commits.json')
    const stats = readJson<Stats>(project, 'stats.json')
    const daily = readJson<{ daily: DailyRow[] }>(project, 'daily.json')
    expect(first.commits).toHaveLength(101)
    expect(first.commits.at(-1)?.hash).toBe((100).toString(16).padStart(40, '0'))
    expect(first.commits.at(-1)?.day).toBe('2020-01-01')
    expect(first.commits.filter(row => row.day === '2026-10-15')).toHaveLength(100)
    expect(first.commits.every(row => row.author === 'Ana')).toBe(true)
    expect(validateReportCommitsData(first, { stats, daily })).toEqual([])
    expect(legacy.commits).toHaveLength(100)
    expect(legacy.commits.every(row => /^[0-9a-f]{7}$/.test(row.hash))).toBe(true)
    expect(legacy.commits.some(row => row.hash === (100).toString(16).padStart(7, '0'))).toBe(false)

    writeFileSync(teamPath, JSON.stringify({ devProfiles: { 'Ana Reagregada': { emails: ['ana-alias@example.test'] } } }))
    expectReaggregateSkips(runTsx(project, 'collect.ts', ['--reaggregate'], collectorEnv(project, reposRoot, 'Pacific/Auckland')))
    const second = readJson<ReportCommitsData>(project, 'report-commits.json')
    const secondStats = readJson<Stats>(project, 'stats.json')
    const secondDaily = readJson<{ daily: DailyRow[] }>(project, 'daily.json')
    expect(second.generatedAt).toBe(secondStats.generatedAt)
    expect(second.commits.every(row => row.author === 'Ana Reagregada')).toBe(true)
    expect(second.commits.map(row => [row.hash, row.day])).toEqual(first.commits.map(row => [row.hash, row.day]))
    expect(validateReportCommitsData(second, { stats: secondStats, daily: secondDaily })).toEqual([])
  }, 60_000)

  it('gera 10 JSONs sintéticos e faz o check-data rejeitar divergência do novo artefato', () => {
    const project = makeProject()
    expectOk(runTsx(project, 'make-demo-data.ts'))
    const dataDir = join(project, 'public', 'data')
    expect(readdirSync(dataDir).sort()).toEqual([
      'branches.json',
      'commits.json',
      'daily.json',
      'github.json',
      'graph-demo-api.json',
      'graph-demo-web.json',
      'releases.json',
      'report-commits.json',
      'stats.json',
      'team.json',
    ])
    expect(existsSync(join(dataDir, 'report-commits.json'))).toBe(true)
    expectOk(runTsx(project, 'check-data.ts'))

    const reportPath = join(dataDir, 'report-commits.json')
    const report = JSON.parse(readFileSync(reportPath, 'utf-8')) as ReportCommitsData
    const originalRows = report.commits.map(row => [row.hash, row.day])
    report.commits.pop()
    writeFileSync(reportPath, JSON.stringify(report))
    const invalid = runTsx(project, 'check-data.ts')
    expect(invalid.status, output(invalid)).toBe(1)
    expect(output(invalid)).toContain('report-commits.json')

    expectOk(runTsx(project, 'make-demo-data.ts', ['--force'], { TZ: 'Pacific/Auckland' }))
    const regenerated = readJson<ReportCommitsData>(project, 'report-commits.json')
    expect(regenerated.commits.map(row => [row.hash, row.day])).toEqual(originalRows)
    expect(validateReportCommitsData(regenerated, {
      stats: readJson<Stats>(project, 'stats.json'),
      daily: readJson<{ daily: DailyRow[] }>(project, 'daily.json'),
    })).toEqual([])

    const legacyPath = join(dataDir, 'commits.json')
    const legacy = JSON.parse(readFileSync(legacyPath, 'utf-8')) as { commits: { hash: string }[] }
    legacy.commits[0].hash = 'a'.repeat(40)
    writeFileSync(legacyPath, JSON.stringify(legacy))
    const invalidLegacy = runTsx(project, 'check-data.ts')
    expect(invalidLegacy.status, output(invalidLegacy)).toBe(1)
    expect(output(invalidLegacy)).toContain('commits.json: hash fora do formato 7-hex')
  }, 60_000)
})
