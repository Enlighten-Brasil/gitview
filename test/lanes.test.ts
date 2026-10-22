import type { LaneInput } from '../src/graph/lanes'
import { describe, expect, it } from 'vitest'
import { computeLanes, mergePassRuns } from '../src/graph/lanes'

/**
 * Semente da infra de testes (issue #248) — `src/graph/lanes.ts` é módulo PURO
 * (zero dependência, sem loader, sem dados gitignored), então roda em node puro
 * e é CI-safe. Fixtures inline; o ground truth é o `git log --all --graph`
 * documentado no cabeçalho do módulo (regras R1–R8).
 */

// grafo de merge mínimo (M junta E e F; ambos nascem de A) — compartilhado
// pelos dois testes que exercitam a semântica de merge
const MERGE_GRAPH: LaneInput[] = [
  { hash: 'M', parents: ['E', 'F'] },
  { hash: 'E', parents: ['A'] },
  { hash: 'F', parents: ['A'] },
  { hash: 'A', parents: [] },
]
// M e C concorrem pela mesma mãe A — cobre R8 (dedupe) e o deslizamento de lane
const R8_GRAPH: LaneInput[] = [
  { hash: 'M', parents: ['A', 'B'] },
  { hash: 'C', parents: ['A'] },
  { hash: 'A', parents: [] },
  { hash: 'B', parents: [] },
]
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
    const rows = computeLanes(MERGE_GRAPH)

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

  it('persist (default): lane viva segue esperando o pai externo, com aresta clipped (R7)', () => {
    const graph: LaneInput[] = [
      { hash: 'C', parents: ['B'] },
      { hash: 'B', parents: ['EXT'] },
    ]
    const rows = computeLanes(graph)

    expect(rows[1]).toMatchObject({ boundaryParents: 1, colsAfter: 1 }) // lane não morre (≠ free)
    expect(rows[1].edges).toEqual([
      { kind: 'in', laneId: 1, c0: 0 },
      { kind: 'out', laneId: 1, c1: 0, clipped: true, stub: false, junction: undefined },
    ])

    const free = computeLanes(graph, { boundaryLanes: 'free' })
    expect(free[1]).toMatchObject({ colsAfter: 0 }) // sem lane zumbi esperando o hash externo
    expect(free[1].edges.at(-1)).toMatchObject({ kind: 'out', clipped: true, stub: true })
  })

  it('dedupeFirstParent: 1ª mãe já esperada vira junção imediata e a lane do commit morre (R8)', () => {
    const dedup = computeLanes(R8_GRAPH, { dedupeFirstParent: true })

    // C (coluna 2) curva para a lane 0 que já espera A — sem criar uma 2ª expectativa
    expect(dedup[1]).toMatchObject({ lane: 2, freshTip: true, colsAfter: 2 })
    expect(dedup[1].edges.find(e => e.junction)).toMatchObject({ kind: 'out', c1: 0, clipped: false })

    const naive = computeLanes(R8_GRAPH)
    expect(naive[1].colsAfter).toBe(3) // sem dedupe sobra a lane zumbi esperando A
    expect(naive[1].edges.find(e => e.kind === 'out')).toMatchObject({ c1: 2, junction: undefined })
  })

  it('pais além do 1º reusam a lane que já espera aquele pai (R4)', () => {
    const rows = computeLanes([
      { hash: 'T', parents: ['A'] },
      { hash: 'S', parents: ['B'] },
      { hash: 'M', parents: ['A', 'B'] },
      { hash: 'A', parents: [] },
      { hash: 'B', parents: [] },
    ])

    const outs = rows[2].edges.filter(e => e.kind === 'out')
    // 1ª mãe na própria lane do M (id3); 2ª mãe reusa a lane id2 de S — nenhum id novo
    expect(outs.map(e => [e.c1, e.laneId])).toEqual([[2, 3], [1, 2]])
    expect(rows[2].colsAfter).toBe(3)
    // A é esperado por T e M → colapso de uma; a lane de B desliza na linha do root
    expect(rows[3].collapsed).toBe(1)
    expect(rows[3].edges.find(e => e.kind === 'pass')).toMatchObject({ c0: 1, c1: 0 })
  })
})

describe('mergePassRuns', () => {
  it('funde "pass" consecutivos da mesma lane/coluna em um run vertical', () => {
    const rows = computeLanes(MERGE_GRAPH)

    const { runs, singles } = mergePassRuns(rows)

    expect(singles).toEqual([])
    expect(runs).toEqual([
      { laneId: 2, col: 1, from: 0, to: 1, clipped: false },
      { laneId: 1, col: 0, from: 2, to: 2, clipped: false },
    ])
  })

  it('pass com deslizamento (c0 != c1) sai em singles p/ o renderer desenhar como bézier', () => {
    // A é raiz e morre: a lane de B desliza uma coluna à esquerda na própria linha
    const rows = computeLanes(R8_GRAPH, { dedupeFirstParent: true })

    const { runs, singles } = mergePassRuns(rows)

    expect(singles).toEqual([
      { row: 2, edge: { kind: 'pass', laneId: 2, c0: 1, c1: 0, clipped: false } },
    ])
    expect(runs).toEqual([
      { laneId: 2, col: 1, from: 0, to: 1, clipped: false },
      { laneId: 1, col: 0, from: 1, to: 1, clipped: false },
    ])
  })
})
