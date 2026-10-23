import { describe, expect, it } from 'vitest'
import { DEFAULT_EXCLUDE_PATHS, matchesGlob } from '../scripts/lib/config'
import { parseGitLog } from '../scripts/lib/numstat'

/** espelho do isExcludedPath privado do collect: a lista default aplicada por matchesGlob */
const isExcluded = (path: string) => DEFAULT_EXCLUDE_PATHS.some(p => matchesGlob(path, p))

// separadores reais do git log usado pelo coletor: RS (0x1E) entre commits, US (0x1F) no cabeçalho
const RS = String.fromCharCode(0x1E)
const US = String.fromCharCode(0x1F)

function commitBlock(hash: string, subject: string, rows: string[]): string {
  return [`${hash}${US}Dev${US}dev@example.com${US}2026-01-01T00:00:00Z${US}${subject}`, ...rows].join('\n')
}

describe('parseGitLog (parse do numstat do coletor)', () => {
  it('soma só as linhas não-excluídas; o commit continua contado (#247)', () => {
    const raw = commitBlock('aaa111', 'feat: misto', [
      '10\t2\tsrc/app.ts',
      '5000\t4000\tpnpm-lock.yaml',
      '3174\t0\t.git-rewrite/map/0003942ce1f34b0c',
    ])
    const commits = parseGitLog(raw, isExcluded)
    expect(commits).toHaveLength(1)
    expect(commits[0].hash).toBe('aaa111')
    expect(commits[0].additions).toBe(10)
    expect(commits[0].deletions).toBe(2)
  })

  it('commit cujas linhas são TODAS excluídas ainda entra, com 0/0 (#247)', () => {
    const raw = commitBlock('bbb222', 'chore: só artefato gerado', [
      '59019\t0\t.git-rewrite/backup-refs',
      '0\t59019\t.git-rewrite/index',
      '-\t-\t.git-rewrite/map/0003942ce1f34b0c',
    ])
    const commits = parseGitLog(raw, isExcluded)
    expect(commits).toHaveLength(1)
    expect(commits[0]).toMatchObject({
      hash: 'bbb222',
      subject: 'chore: só artefato gerado',
      additions: 0,
      deletions: 0,
    })
  })

  it('cabeçalho incompleto não vira commit', () => {
    const raw = `ccc333${US}Dev${US}curto`
    expect(parseGitLog(raw, isExcluded)).toHaveLength(0)
  })

  it('linhas malformadas são ignoradas sem derrubar o commit', () => {
    const raw = commitBlock('ddd444', 'fix: ruído no log', [
      'linha sem tab',
      '1\t2\tok.ts',
      '9\t9',
    ])
    const commits = parseGitLog(raw, isExcluded)
    expect(commits).toHaveLength(1)
    expect(commits[0]).toMatchObject({ additions: 1, deletions: 2 })
  })

  it('vários commits separados por RS', () => {
    const raw = [
      commitBlock('eee555', 'um', ['1\t0\ta.ts']),
      commitBlock('fff666', 'dois', ['0\t1\tb.ts']),
      '',
    ].join(RS)
    const commits = parseGitLog(raw, isExcluded)
    expect(commits.map(c => c.hash)).toEqual(['eee555', 'fff666'])
  })
})
