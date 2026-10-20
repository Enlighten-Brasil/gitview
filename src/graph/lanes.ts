/**
 * Módulo PURO de cálculo de lanes para o grafo de commits — código validado
 * no spike #125 (regras R1–R8, testado contra o ground truth ASCII do
 * `git log --all --graph --date-order`, incluindo octopus, cruzamentos e
 * parents fora da janela). Zero dependências: roda em node (probes) e no
 * browser (renderer CommitGraph.vue).
 *
 * Entrada: commits na ordem de exibição (`git log --all --date-order`, mais
 * recente primeiro), cada um { hash, parents: string[] } — campos extras
 * (author/date/subject/refs) são opacos para o algoritmo.
 *
 * Regras (estilo git log --graph, COM colapso de lanes duplicadas):
 *  R1. O commit ocupa a lane MAIS À ESQUERDA cujo próximo esperado == ele.
 *  R2. Lanes extras esperando o MESMO commit colapsam na escolhida: geram
 *      aresta de junção ('in' com collapse) e são removidas (as lanes à
 *      direita deslizam 1 coluna p/ esquerda — aresta 'pass' com c0 != c1).
 *  R3. A primeira mãe continua na lane do próprio commit.
 *  R4. Pais além do 1º: reusa a lane mais à esquerda que já espera aquele
 *      pai (sem duplicar); senão aloca nova lane à direita.
 *  R5. Commit sem nenhuma lane esperando (tipos de ramo: pontas de branch
 *      dentro da janela) ganha lane nova à direita, sem aresta de entrada.
 *  R6. Root (sem pais): a lane do commit morre nele.
 *  R7. Parent fora da janela (boundary — hash ausente do conjunto):
 *      - modo 'persist' (fiel ao git): a lane continua viva esperando o hash
 *        (pode colapsar com outros filhos do mesmo pai externo) e TODA aresta
 *        dessa lane vira clipped=true (render tracejado);
 *      - modo 'free' (usado na UI): NÃO mantém lane — a aresta é clipped e
 *        termina na própria linha (stub tracejado).
 *  R8. (dedupeFirstParent) Se a primeira mãe JÁ é esperada por outra lane
 *      viva, a lane do commit curva até ela e morre (junção imediata, como o
 *      git desenha) em vez de duplicar a expectativa — menos colunas.
 *
 * Configuração da UI (requisito do GO do spike): { boundaryLanes: 'free',
 * dedupeFirstParent: true } — modo "freedp": 19 colunas no pior window real
 * (N=1000) vs 22 do ASCII do git, sem lanes zumbis, junções idênticas às do
 * git.
 *
 * Saída por linha: { i, hash, lane, colsBefore, colsAfter, maxCol, freshTip,
 * collapsed, edges } onde edges são segmentos DENTRO da linha (yTop→yBottom,
 * círculo no meio da linha):
 *   { kind:'pass', laneId, c0, c1, clipped }  // lane atravessa a linha; c0
 *                                             // (topo, coords "antes") pode
 *                                             // diferir de c1 (base, coords
 *                                             // "depois") quando colapsos à
 *                                             // esquerda deslizam a lane
 *   { kind:'in',  laneId, c0, collapse? }     // topo → círculo (lane própria
 *                                             // + lanes que colapsam nele)
 *   { kind:'out', laneId, c1, clipped, stub? }// círculo → base (aresta p/
 *                                             // pai; stub=true só no 'free')
 * Geometria garantida: a coluna do círculo (lane) NUNCA desliza na própria
 * linha (colapsos só ocorrem à direita dela), então c0 do 'in' e o topo do
 * 'out' compartilham a mesma coluna do círculo.
 */

export interface LaneInput {
  hash: string
  parents: string[]
}

export interface LaneEdge {
  kind: 'pass' | 'in' | 'out'
  /** identidade estável da lane (branch) — a cor do renderer segue ela */
  laneId: number
  /** coluna no TOPO da linha (coords "antes") — 'pass' e 'in' */
  c0?: number
  /** coluna na BASE da linha (coords "depois") — 'pass' e 'out' */
  c1?: number
  /** 'in' de uma lane duplicada colapsando neste commit (R2) */
  collapse?: boolean
  /** parent fora da janela (R7) — render tracejado */
  clipped?: boolean
  /** aresta que termina na própria linha (modo 'free') */
  stub?: boolean
  /** 'out' que curva para outra lane viva (dedupe da 1ª mãe, R8) */
  junction?: boolean
}

export interface LaneRow {
  i: number
  hash: string
  /** coluna do círculo (nunca desliza na própria linha) */
  lane: number
  colsBefore: number
  colsAfter: number
  /** colunas visuais usadas nesta linha (≥ lane+1) */
  maxCol: number
  /** ponta nova (R5): sem aresta de entrada */
  freshTip: boolean
  /** lanes duplicadas que colapsaram nesta linha (R2) */
  collapsed: number
  nParents: number
  /** pais fora da janela (hash ausente do conjunto) */
  boundaryParents: number
  edges: LaneEdge[]
}

export interface LaneOptions {
  /** R7: 'persist' (fiel ao git) | 'free' (sem lanes zumbis — recomendado p/ UI com janela) */
  boundaryLanes?: 'persist' | 'free'
  /** R8: 1ª mãe já esperada por outra lane viva → junção imediata (menos colunas) */
  dedupeFirstParent?: boolean
}

interface ActiveLane {
  id: number
  /** hash do próximo commit esperado (null nunca ocorre na prática — alvo sempre é hash) */
  target: string | null
  boundary: boolean
  /** lane temporária SÓ p/ geometria da linha (stub de pai externo no 'free') */
  temp?: boolean
}

interface PendingOut {
  lane?: number
  /** coluna de origem de um stub 'free' (lane removida na mesma linha) */
  stubAt?: number
  clipped: boolean
  laneId: number
  junction?: boolean
  stub?: boolean
}

export function computeLanes(commits: LaneInput[], opts: LaneOptions = {}): LaneRow[] {
  const boundaryMode = opts.boundaryLanes ?? 'persist'
  const inWindow = new Set<string>()
  for (const c of commits) inWindow.add(c.hash)

  let nextLaneId = 1
  let lanes: ActiveLane[] = [] // lanes ativas; target = hash do próximo commit esperado
  const rows: LaneRow[] = []

  for (let i = 0; i < commits.length; i++) {
    const c = commits[i]
    const colsBefore = lanes.length
    const edges: LaneEdge[] = []

    // R1/R5 — quem esperava este commit?
    const matching: number[] = []
    for (let k = 0; k < lanes.length; k++) {
      if (lanes[k].target === c.hash)
        matching.push(k)
    }
    const work = lanes.slice() // estado mutável desta linha
    let freshTip = false
    let commitCol: number
    if (matching.length === 0) {
      // R5 — ponta nova: lane à direita, sem aresta de entrada
      freshTip = true
      commitCol = work.length
      work.push({ id: nextLaneId++, target: c.hash, boundary: false })
    }
    else {
      commitCol = matching[0]
      edges.push({ kind: 'in', laneId: work[commitCol].id, c0: commitCol })
    }
    // R2 — colapso das lanes duplicadas
    const removed = new Set<number>(matching.slice(1))
    for (const k of matching.slice(1)) {
      edges.push({ kind: 'in', laneId: work[k].id, c0: k, collapse: true })
    }

    const isBoundary = (p: string) => !inWindow.has(p)
    const parents = c.parents ?? []
    /** arestas de saída pendentes de mapeamento de coluna */
    const outs: PendingOut[] = []

    if (parents.length === 0) {
      // R6 — root: a lane morre no commit
      removed.add(commitCol)
    }
    else {
      // R3 — primeira mãe continua na lane do commit
      const p1 = parents[0]
      const b1 = isBoundary(p1)
      // R8 — dedupe: outra lane viva já espera p1? curva e morre (junção)
      let dedupTarget = -1
      if (opts.dedupeFirstParent && !(b1 && boundaryMode === 'free')) {
        for (let k = 0; k < work.length; k++) {
          if (k !== commitCol && !removed.has(k) && !work[k].temp && work[k].target === p1) {
            dedupTarget = k
            break
          }
        }
      }
      if (b1 && boundaryMode === 'free') {
        removed.add(commitCol)
        outs.push({ clipped: true, stubAt: commitCol, laneId: work[commitCol].id })
      }
      else if (dedupTarget !== -1) {
        removed.add(commitCol)
        outs.push({ lane: dedupTarget, clipped: false, laneId: work[dedupTarget].id, junction: true })
      }
      else {
        work[commitCol].target = p1
        work[commitCol].boundary = b1
        outs.push({ lane: commitCol, clipped: b1, laneId: work[commitCol].id })
      }
      // R4 — demais pais
      const seen = new Set<string>([p1])
      for (const p of parents.slice(1)) {
        if (seen.has(p))
          continue // pais duplicados (raro) não geram 2 arestas
        seen.add(p)
        const b = isBoundary(p)
        if (b && boundaryMode === 'free') {
          // lane temporária SÓ p/ geometria desta linha; some na seguinte
          const col = work.length
          work.push({ id: nextLaneId++, target: p, boundary: true, temp: true })
          outs.push({ lane: col, clipped: true, stub: true, laneId: work[col].id })
        }
        else {
          let found = -1
          for (let k = 0; k < work.length; k++) {
            if (k !== commitCol && work[k].target === p) {
              found = k
              break
            }
          }
          if (found === -1) {
            found = work.length
            work.push({ id: nextLaneId++, target: p, boundary: b })
          }
          outs.push({ lane: found, clipped: b, laneId: work[found].id })
        }
      }
    }

    // Mapeamento velho→novo (remoções deslizam as lanes à direita p/ esquerda)
    const after: ActiveLane[] = []
    const newIndexOf = new Map<number, number>() // índice em work → índice em after
    for (let k = 0; k < work.length; k++) {
      if (removed.has(k))
        continue
      newIndexOf.set(k, after.length)
      after.push(work[k])
    }
    // Coluna efetiva de um stub 'free' (lane removida): posição onde estaria
    const stubColumn = (oldCol: number): number => {
      let n = 0
      for (let k = 0; k < oldCol; k++) {
        if (!removed.has(k))
          n++
      }
      return n
    }

    // Arestas 'pass' — lanes que atravessam a linha (nem commit, nem colapso,
    // nem temp): c0 = coluna no topo, c1 = coluna na base
    for (let k = 0; k < work.length; k++) {
      if (removed.has(k) || k === commitCol || work[k].temp)
        continue
      const c1 = newIndexOf.get(k)
      edges.push({ kind: 'pass', laneId: work[k].id, c0: k, c1, clipped: work[k].boundary })
    }
    // Arestas 'out' — círculo → base
    for (const o of outs) {
      const c1 = o.stubAt !== undefined ? stubColumn(o.stubAt) : newIndexOf.get(o.lane ?? -1)
      edges.push({ kind: 'out', laneId: o.laneId, c1, clipped: !!o.clipped, stub: !!o.stub || o.stubAt !== undefined, junction: o.junction })
    }

    let maxCol = commitCol
    for (const e of edges) {
      if (e.c0 !== undefined && e.c0 > maxCol)
        maxCol = e.c0
      if (e.c1 !== undefined && e.c1 > maxCol)
        maxCol = e.c1
    }
    // Lanes ativas p/ a próxima linha (temps do modo 'free' não sobrevivem)
    lanes = after.filter(l => !l.temp)

    rows.push({
      i,
      hash: c.hash,
      lane: commitCol,
      colsBefore,
      colsAfter: lanes.length,
      maxCol: maxCol + 1, // colunas visuais usadas nesta linha
      freshTip,
      collapsed: matching.length > 0 ? matching.length - 1 : 0,
      nParents: parents.length,
      boundaryParents: parents.filter(isBoundary).length,
      edges,
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// Runs verticais fundidas (requisito do spike #125: 14.557 → 5.669 elementos;
// build 135 → 41 ms) — 1 path por trecho vertical contínuo em vez de 1 por
// linha.
// ---------------------------------------------------------------------------

export interface VerticalRun {
  laneId: number
  col: number
  /** primeira linha do run (índice absoluto `i`, inclusivo) */
  from: number
  /** última linha do run (índice absoluto `i`, inclusivo) */
  to: number
  clipped: boolean
}

export interface SinglePass {
  /** índice absoluto da linha */
  row: number
  edge: LaneEdge
}

/**
 * Funde as arestas 'pass' verticais (c0 === c1) de linhas CONSECUTIVAS com o
 * mesmo laneId/coluna/clipado em runs únicos; 'pass' com deslizamento
 * (c0 !== c1) sai em `singles` p/ o renderer desenhar como bézier. A janela
 * renderizada começa sempre na linha 0 ("mostrar mais antigos" só cresce),
 * então from/to absolutos valem como posição geométrica.
 */
export function mergePassRuns(rows: LaneRow[]): { runs: VerticalRun[], singles: SinglePass[] } {
  const runs: VerticalRun[] = []
  const singles: SinglePass[] = []
  /** run aberto por laneId — continua enquanto linha/coluna/clipado baterem */
  const open = new Map<number, VerticalRun>()

  const closeRun = (laneId: number) => {
    const run = open.get(laneId)
    if (run) {
      runs.push(run)
      open.delete(laneId)
    }
  }

  for (const row of rows) {
    const seen = new Set<number>()
    for (const e of row.edges) {
      if (e.kind !== 'pass' || e.c0 === undefined || e.c1 === undefined)
        continue
      seen.add(e.laneId)
      const clipped = !!e.clipped
      if (e.c0 === e.c1) {
        const cur = open.get(e.laneId)
        if (cur && cur.col === e.c0 && cur.clipped === clipped && cur.to === row.i - 1) {
          cur.to = row.i
          continue
        }
        closeRun(e.laneId)
        open.set(e.laneId, { laneId: e.laneId, col: e.c0, from: row.i, to: row.i, clipped })
      }
      else {
        // deslizamento: quebra o run e vira bézier avulsa
        closeRun(e.laneId)
        singles.push({ row: row.i, edge: e })
      }
    }
    // lanes que não atravessam esta linha fecham o run aberto
    for (const laneId of [...open.keys()]) {
      if (!seen.has(laneId))
        closeRun(laneId)
    }
  }
  for (const laneId of [...open.keys()]) closeRun(laneId)

  return { runs, singles }
}
