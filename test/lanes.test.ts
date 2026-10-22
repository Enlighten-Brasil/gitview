import { describe, expect, it } from 'vitest'
import { computeLanes, mergePassRuns } from '../src/graph/lanes'

/**
 * Semente da infra de testes (issue #248) — `src/graph/lanes.ts` é módulo PURO
 * (zero dependência, sem loader, sem dados gitignored), então roda em node puro
 * e é CI-safe. Fixtures inline; o ground truth é o `git log --all --graph`
 * documentado no cabeçalho do módulo (regras R1–R8).
 */
describe('computeLanes', () => {
  it('linha reta: uma lane viva e o root morre na própria linha (R3/R6)', () => {
    const rows = computeLanes([
      { hash: 'C', parents: ['B'] },
      { hash: 'B', parents: ['A'] },
      { hash: 'A', parents: [] },
    ])

    expect(rows.map(r => r.lane)).toEqual([0, 0, 0])
    // só a ponta mais recente nasce fresh; o resto é alcançado pelo parent
    expect(rows.map(r => r.freshTip)).toEqual([true, false, false])
    expect(rows.map(r => r.colsAfter)).toEqual([1, 1, 0])
    expect(rows[1].edges).toEqual([
      { kind: 'in', laneId: 1, c0: 0 },
      { kind: 'out', laneId: 1, c1: 0, clipped: false, stub: false, junction: undefined },
    ])
  })

  it('merge: colapsa as duas lanes que esperavam o mesmo pai (R2)', () => {
    const rows = computeLanes([
      { hash: 'M', parents: ['E', 'F'] },
      { hash: 'E', parents: ['A'] },
      { hash: 'F', parents: ['A'] },
      { hash: 'A', parents: [] },
    ])

    // M abre 2 lanes (1ª mãe na própria coluna, 2ª mãe aloca à direita — R3/R4)
    expect(rows[0].colsAfter).toBe(2)
    expect(rows[0].nParents).toBe(2)

    // A é esperado por 2 lanes → colapso de uma, sem aresta duplicada
    expect(rows[3].collapsed).toBe(1)
    expect(rows[3].edges.filter(e => e.kind === 'in')).toHaveLength(2)
    expect(rows[3].edges.find(e => e.collapse)).toMatchObject({ kind: 'in', c0: 1 })
    expect(rows[3].colsAfter).toBe(0)
  })

  it('modo free: pai fora da janela vira stub clipped e não mantém lane (R7)', () => {
    const rows = computeLanes([{ hash: 'B', parents: ['EXT'] }], { boundaryLanes: 'free' })

    expect(rows[0].boundaryParents).toBe(1)
    expect(rows[0].colsAfter).toBe(0) // sem lane zumbi esperando o hash externo
    expect(rows[0].edges).toEqual([
      { kind: 'out', laneId: 1, c1: 0, clipped: true, stub: true, junction: undefined },
    ])
  })

  it('ponta nova que ninguém esperava ganha lane à direita, sem aresta de entrada (R5)', () => {
    const rows = computeLanes([
      { hash: 'C2', parents: ['B2'] },
      { hash: 'C1', parents: ['B1'] },
      { hash: 'B1', parents: [] },
      { hash: 'B2', parents: [] },
    ])

    expect(rows[0].freshTip).toBe(true)
    expect(rows[1].freshTip).toBe(true)
    expect(rows[1].lane).toBe(1) // coluna 1: a lane 0 segue esperando B1
    expect(rows[1].edges.some(e => e.kind === 'in')).toBe(false)
    expect(rows[1].edges.find(e => e.kind === 'pass')).toMatchObject({ c0: 0, c1: 0 })
  })
})

describe('mergePassRuns', () => {
  it('funde "pass" consecutivos da mesma lane/coluna em um run vertical', () => {
    const rows = computeLanes([
      { hash: 'M', parents: ['E', 'F'] },
      { hash: 'E', parents: ['A'] },
      { hash: 'F', parents: ['A'] },
      { hash: 'A', parents: [] },
    ])

    const { runs, singles } = mergePassRuns(rows)

    expect(singles).toEqual([])
    expect(runs).toEqual([
      { laneId: 2, col: 1, from: 0, to: 1, clipped: false },
      { laneId: 1, col: 0, from: 2, to: 2, clipped: false },
    ])
  })
})
