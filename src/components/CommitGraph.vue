<script setup lang="ts">
import type { LaneRow } from '@/graph/lanes'
import type { GraphRef } from '@/graph/refs'
import type { GraphCommit, GraphData } from '@/types'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { ct } from '@/chartTheme'
import TablePanel from '@/components/TablePanel.vue'
import { stats } from '@/data'
import { fmtDate, fmtDateTimeShort, fmtDaysAgo } from '@/format'
import { computeLanes, mergePassRuns } from '@/graph/lanes'
import { laneColor, refColor, useThemeVersion } from '@/graph/palette'
import { parseRefs, refKey } from '@/graph/refs'
import { loadGraphData } from '@/graphData'

/**
 * Grafo de commits (issue #127) — renderer SVG PURO (zero ECharts; o gate de
 * chunk do ChartPanel não cresce) sobre as lanes calculadas em
 * src/graph/lanes.ts no modo "freedp" validado no spike #125 (free + dedupe
 * da 1ª mãe: 19 colunas no pior window real vs 22 do ASCII do git).
 *
 * JANELA FIXA INTENCIONAL (categoria do AGENTS.md): os últimos N commits do
 * graph-REPO.json, rotulada no rodapé — o grafo NÃO segue os filtros de
 * período/bots da rota porque remover commits quebra cadeias de merge e
 * desfigura as lanes. Os demais painéis da página seguem os filtros.
 *
 * Windowing vertical (requisito do GO do spike): render completo de 1000
 * linhas mede ~129-135 ms (> teto de 100 ms) — a seção renderiza
 * INITIAL_ROWS linhas e cresce client-side no "mostrar mais antigos" (padrão
 * shownTags de repos/[name].vue). Arestas verticais fundidas em runs
 * (mergePassRuns): 1 path por trecho contínuo em vez de 1 por linha.
 *
 * Parent fora da janela: aresta clipada tracejada (classe `cg-clipped`,
 * stroke-dasharray 3 3 + opacidade 0,65) com marcador de seta "continua"
 * (`#cg-continua`) — nunca desenha para índice inexistente.
 */
const props = defineProps<{ repo: string }>()

// --- geometria validada no spike #125 --------------------------------------
const ROW_H = 24
const COL_W = 16
const DOT_R = 4.5
const PAD_X = 12
const PAD_Y = 8
const SUBJECT_W = 420 // orçamento do subject (truncagem medida, máx real 419,9 px)
const REFS_W = 160
const AUTHOR_W = 116
const DATE_W = 96

// --- windowing vertical: render inicial medido < 100 ms no build real
// (300 linhas mediram ~189 ms — acima do teto do GO do spike #125; 60 linhas
// ainda oscilaram 99-115 ms na 1ª visita a frio. A janela inicial fica em 40
// linhas ≈ 1 viewport de grafo, o conceito de "janela visível" do spike,
// conforme a regra da issue: "se o render inicial passar de 100 ms, reduza a
// janela inicial") ---
const INITIAL_ROWS = 40
const ROWS_STEP = 300

const SUBJECT_FONT = '11px "Segoe UI", system-ui, sans-serif'
const META_FONT = '10.5px "Segoe UI", system-ui, sans-serif'
const CHIP_FONT = '600 9.5px "Segoe UI", system-ui, sans-serif'

// --- carga por repo (Map cache + shallowRef/markRaw em src/graphData.ts) ----
const data = shallowRef<GraphData | null>(null)
const failure = ref<{ status?: number, message: string } | null>(null)
const shown = ref(INITIAL_ROWS)
const rootEl = ref<HTMLElement | null>(null)

// --- lanes (algoritmo puro; janela inteira p/ geometria estável) ------------
const laneRows = computed<LaneRow[]>(() =>
  data.value
    ? computeLanes(data.value.commits, { boundaryLanes: 'free', dedupeFirstParent: true })
    : [],
)

/**
 * Agenda o primeiro render do grafo para um momento ocioso da página: a seção
 * fica abaixo da dobra e o fetch/patch não deve competir com a pintura crítica
 * (cards + ECharts + releases) na 1ª visita. Fallback p/ navegadores sem
 * requestIdleCallback; timeout garante o render mesmo sob carga contínua.
 */
function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function')
      requestIdleCallback(() => resolve(), { timeout: 400 })
    else
      setTimeout(resolve, 120)
  })
}

async function load() {
  failure.value = null
  try {
    const loaded = await loadGraphData(props.repo)
    // chamada dupla (mount + watch da rota) com o MESMO payload: já renderizado
    if (data.value === loaded)
      return
    // a seção fica abaixo da dobra — o render não compete com a pintura
    // crítica da página (cards/ECharts/releases) na 1ª visita
    await whenIdle()
    data.value = loaded
    shown.value = INITIAL_ROWS
  }
  catch (err) {
    data.value = null
    const e = err as { status?: number, message?: string }
    failure.value = { status: e.status, message: e.message ?? String(err) }
  }
}

onMounted(load)
watch(() => props.repo, load)

const commits = computed<GraphCommit[]>(() => data.value?.commits ?? [])
const shownCount = computed(() => Math.min(shown.value, commits.value.length))

/** colunas visuais GLOBAIS — a largura do SVG não muda no "mostrar mais" */
const maxCols = computed(() => laneRows.value.reduce((m, r) => Math.max(m, r.maxCol), 1))

const layout = computed(() => {
  const laneW = maxCols.value * COL_W
  const textX = PAD_X + laneW + 14
  const refsX = textX + SUBJECT_W + 10
  const authorX = refsX + REFS_W
  const dateX = authorX + AUTHOR_W
  return { textX, refsX, authorX, dateX, totalW: dateX + DATE_W + PAD_X }
})

// --- tema (lanes: PALETTE dark / tons 600 light — reativo via versão) -------
const themeVersion = useThemeVersion()

// --- truncagem medida (canvas.measureText + busca binária, cache) -----------
let measureCtx: CanvasRenderingContext2D | null = null
const truncCache = new Map<string, string>()

function textWidth(text: string, font: string): number {
  if (!measureCtx)
    measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx)
    return text.length * 6 // sem canvas: aproximação conservadora
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

function truncate(text: string, font: string, budget: number): string {
  const key = `${font}\u0000${budget}\u0000${text}`
  const hit = truncCache.get(key)
  if (hit !== undefined)
    return hit
  let out = text
  if (textWidth(text, font) > budget) {
    let lo = 0
    let hi = text.length
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2)
      if (textWidth(`${text.slice(0, mid)}…`, font) <= budget)
        lo = mid
      else
        hi = mid - 1
    }
    out = `${text.slice(0, lo)}…`
  }
  truncCache.set(key, out)
  return out
}

// --- datas (linha: dd/mm/aaaa; tooltip: dd/mm/aaaa hh:mm via format.ts) -----

const windowDays = computed(() => {
  const cs = commits.value
  if (cs.length < 2)
    return 0
  const first = new Date(cs[0].date).getTime()
  const last = new Date(cs[cs.length - 1].date).getTime()
  return Math.max(0, Math.round((first - last) / 86_400_000))
})

// --- link de commit: repoUrls do stats.json (zero dado novo) ----------------
const commitBase = computed(() => stats.value?.repoUrls?.[props.repo] ?? null)
function commitUrl(hash: string): string | null {
  return commitBase.value ? `${commitBase.value}/commit/${hash}` : null
}

// --- refs da janela: chips clicáveis + destaque de lane ---------------------
const refIndex = computed(() => {
  const m = new Map<string, { ref: GraphRef, rows: number[] }>()
  for (let i = 0; i < commits.value.length; i++) {
    for (const r of parseRefs(commits.value[i].refs)) {
      const key = refKey(r)
      const hit = m.get(key)
      if (hit)
        hit.rows.push(i)
      else
        m.set(key, { ref: r, rows: [i] })
    }
  }
  return m
})

const REF_TYPE_ORDER: Record<GraphRef['type'], number> = { HEAD: 0, branch: 1, tag: 2, remote: 3 }

const windowRefs = computed(() => {
  const out: { key: string, name: string, type: GraphRef['type'] }[] = []
  for (const [key, v] of refIndex.value)
    out.push({ key, name: v.ref.name, type: v.ref.type })
  return out.sort((a, b) => REF_TYPE_ORDER[a.type] - REF_TYPE_ORDER[b.type] || a.name.localeCompare(b.name))
})

const hoverRef = ref<string | null>(null)
const pinRef = ref<string | null>(null)
const effectiveRef = computed(() => hoverRef.value ?? pinRef.value)

/** laneIds das linhas que carregam o ref ativo — o destaque ilumina a lane inteira */
const activeLaneIds = computed<Set<number> | null>(() => {
  const key = effectiveRef.value
  if (!key)
    return null
  const hit = refIndex.value.get(key)
  if (!hit)
    return null
  const ids = new Set<number>()
  for (const i of hit.rows) {
    const r = laneRows.value[i]
    if (!r)
      continue
    for (const e of r.edges) {
      if (
        (e.kind === 'in' && e.c0 === r.lane)
        || (e.kind === 'out' && (e.junction || e.c1 === r.lane))
        || (e.kind === 'pass' && (e.c0 === r.lane || e.c1 === r.lane))
      ) {
        ids.add(e.laneId)
      }
    }
  }
  return ids
})

function togglePin(key: string) {
  pinRef.value = pinRef.value === key ? null : key
}

// --- modelo de render (primitivas SVG planas p/ v-for) ----------------------
interface SegView {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  clipped: boolean
  laneId: number
}
interface CurveView {
  d: string
  color: string
  clipped: boolean
  laneId: number
}
interface ChipView {
  label: string
  x: number
  w: number
  color: string
}
interface RowView {
  i: number
  hash: string
  shortHash: string
  y: number
  cy: number
  cx: number
  color: string
  merge: boolean
  subject: string
  fullSubject: string
  author: string
  date: string
  tipDate: string
  refsLabel: string
  chips: ChipView[]
  href: string | null
  refHit: boolean
  dim: boolean
}

const rowTop = (i: number) => PAD_Y + i * ROW_H

const view = computed(() => {
  void themeVersion.value // recalcula cores na troca de tema
  const all = laneRows.value
  const n = Math.min(shown.value, all.length)
  const L = layout.value
  const active = activeLaneIds.value
  const hitKey = effectiveRef.value
  const segs: SegView[] = []
  const curves: CurveView[] = []

  const colX = (c: number) => PAD_X + c * COL_W + COL_W / 2
  const pushSeg = (x1: number, y1: number, x2: number, y2: number, color: string, clipped: boolean, laneId: number) =>
    segs.push({ x1, y1, x2, y2, color, clipped, laneId })

  // runs verticais fundidas (pass sem deslizamento em linhas consecutivas)
  const { runs, singles } = mergePassRuns(all.slice(0, n))
  for (const run of runs) {
    pushSeg(colX(run.col), rowTop(run.from), colX(run.col), rowTop(run.to) + ROW_H, laneColor(run.laneId), run.clipped, run.laneId)
  }
  // pass com deslizamento de coluna: bézier com controles na meia-altura
  for (const { row, edge } of singles) {
    const yTop = rowTop(row)
    const yMid = yTop + ROW_H / 2
    const yBot = yTop + ROW_H
    const x0 = colX(edge.c0 ?? 0)
    const x1 = colX(edge.c1 ?? 0)
    curves.push({ d: `M ${x0} ${yTop} C ${x0} ${yMid} ${x1} ${yMid} ${x1} ${yBot}`, color: laneColor(edge.laneId), clipped: !!edge.clipped, laneId: edge.laneId })
  }

  const rows: RowView[] = []
  let clippedCount = 0
  for (const r of all.slice(0, n)) {
    const c = commits.value[r.i]
    if (!c)
      continue
    const yTop = rowTop(r.i)
    const cy = yTop + ROW_H / 2
    const yBot = yTop + ROW_H
    const cx = colX(r.lane)

    // arestas in/out da linha (as pass já foram fundidas acima)
    for (const e of r.edges) {
      if (e.kind === 'pass')
        continue
      const color = laneColor(e.laneId)
      if (e.clipped)
        clippedCount++
      if (e.kind === 'in') {
        const x0 = colX(e.c0 ?? r.lane)
        if (x0 === cx)
          pushSeg(x0, yTop, cx, cy, color, !!e.clipped, e.laneId)
        else
          curves.push({ d: `M ${x0} ${yTop} C ${x0} ${yTop + ROW_H * 0.25} ${cx} ${yTop + ROW_H * 0.25} ${cx} ${cy}`, color, clipped: !!e.clipped, laneId: e.laneId })
      }
      else {
        const x1 = colX(e.c1 ?? r.lane)
        if (x1 === cx)
          pushSeg(cx, cy, x1, yBot, color, !!e.clipped, e.laneId)
        else
          curves.push({ d: `M ${cx} ${cy} C ${cx} ${yTop + ROW_H * 0.75} ${x1} ${yTop + ROW_H * 0.75} ${x1} ${yBot}`, color, clipped: !!e.clipped, laneId: e.laneId })
      }
    }

    // laneId do círculo: 'in' na própria coluna; senão o 1º 'out' (freshTip,
    // junção R8 ou stub); senão (root ponta) fallback à coluna
    let ownLaneId = -1
    for (const e of r.edges) {
      if (e.kind === 'in' && e.c0 === r.lane) {
        ownLaneId = e.laneId
        break
      }
    }
    if (ownLaneId === -1) {
      for (const e of r.edges) {
        if (e.kind === 'out' && (e.junction || e.c1 === r.lane || e.stub)) {
          ownLaneId = e.laneId
          break
        }
      }
    }
    if (ownLaneId === -1)
      ownLaneId = r.lane

    const refs = parseRefs(c.refs)
    const refKeys = new Set(refs.map(refKey))
    // chips da linha: cabem no orçamento REFS_W (com reserva p/ "+n"); sobra vira "+n"
    const chips: ChipView[] = []
    let chipX = L.refsX
    for (const gr of refs) {
      const remaining = L.refsX + REFS_W - 30 - chipX
      if (remaining < 20)
        break
      const w = Math.min(textWidth(gr.name, CHIP_FONT) + 10, remaining)
      chips.push({ label: truncate(gr.name, CHIP_FONT, w - 8), x: chipX, w, color: refColor(gr.type) })
      chipX += w + 4
    }
    const extra = refs.length - chips.length
    if (extra > 0) {
      const label = `+${extra}`
      chips.push({ label, x: chipX, w: textWidth(label, CHIP_FONT) + 10, color: refColor('remote') })
    }

    const refHit = hitKey !== null && refKeys.has(hitKey)
    rows.push({
      i: r.i,
      hash: c.hash,
      shortHash: c.hash.slice(0, 7),
      y: yTop,
      cy,
      cx,
      color: laneColor(ownLaneId),
      merge: r.nParents > 1,
      subject: truncate(c.subject, SUBJECT_FONT, SUBJECT_W),
      fullSubject: c.subject,
      author: truncate(c.author, META_FONT, AUTHOR_W - 10),
      date: fmtDate(c.date),
      tipDate: fmtDateTimeShort(c.date),
      refsLabel: refs.map(gr => (gr.type === 'HEAD' ? `HEAD -> ${gr.name}` : gr.type === 'tag' ? `tag: ${gr.name}` : gr.name)).join(', '),
      chips,
      href: commitUrl(c.hash),
      refHit,
      dim: active !== null && !refHit && !active.has(ownLaneId),
    })
  }

  return {
    segs,
    curves,
    rows,
    clippedCount,
    height: PAD_Y * 2 + n * ROW_H,
  }
})

function edgeClass(laneId: number, clipped: boolean) {
  const active = activeLaneIds.value
  return {
    'cg-clipped': clipped,
    'cg-dim': active !== null && !active.has(laneId),
    'cg-hl': active !== null && active.has(laneId),
  }
}

// --- tooltip (HTML sobreposto — um só p/ todas as linhas) -------------------
interface TipState {
  x: number
  y: number
  subject: string
  author: string
  date: string
  refs: string
  hash: string
}
const tip = ref<TipState | null>(null)

function showTip(ev: MouseEvent, row: RowView) {
  const rect = rootEl.value?.getBoundingClientRect()
  if (!rect)
    return
  const x = Math.min(Math.max(4, ev.clientX - rect.left + 14), Math.max(4, rect.width - 380))
  const y = Math.min(Math.max(4, ev.clientY - rect.top + 16), Math.max(4, rect.height - 130))
  tip.value = { x, y, subject: row.fullSubject, author: row.author, date: row.tipDate, refs: row.refsLabel, hash: row.shortHash }
}

function hideTip() {
  tip.value = null
}

// --- "mostrar mais antigos" (windowing client-side) -------------------------
function showMore() {
  shown.value += ROWS_STEP
}
</script>

<template>
  <TablePanel title="Grafo de commits" icon="i-lucide-git-graph" :count="commits.length || undefined">
    <template v-if="data" #actions>
      <span class="text-dimmed text-xs" :title="data.generatedAt">coletado {{ fmtDaysAgo(data.generatedAt) }}</span>
    </template>

    <div v-if="failure?.status === 404" class="py-10 text-center text-sm text-muted">
      Sem grafo de commits para esse repo — rode <code>pnpm collect</code>.
    </div>
    <div v-else-if="failure" class="py-10 text-center text-sm text-error">
      Falha ao carregar o grafo: {{ failure.message }}
    </div>
    <div v-else-if="!data" class="py-10 text-center text-sm text-muted">
      Carregando grafo…
    </div>

    <div
      v-else
      ref="rootEl"
      class="relative"
    >
      <!-- chips dos refs DA JANELA: passar/clicar destaca a lane -->
      <div v-if="windowRefs.length" class="flex flex-wrap gap-1 px-4 pt-3 max-h-[72px] overflow-y-auto">
        <UTooltip
          v-for="r in windowRefs"
          :key="r.key"
          :text="pinRef === r.key ? 'clique p/ soltar o destaque' : 'clique p/ fixar o destaque'"
        >
          <button
            type="button"
            class="cg-chip"
            :class="{ active: effectiveRef === r.key }"
            @mouseenter="hoverRef = r.key"
            @mouseleave="hoverRef = null"
            @click="togglePin(r.key)"
          >
            <span class="inline-block size-2 rounded-full shrink-0" :style="{ background: refColor(r.type) }" />
            <span class="truncate max-w-[200px]">{{ r.name }}</span>
          </button>
        </UTooltip>
      </div>

      <svg
        class="cg-svg block w-full h-auto mt-1"
        :width="layout.totalW"
        :height="view.height"
        :viewBox="`0 0 ${layout.totalW} ${view.height}`"
        role="img"
        :aria-label="`Grafo dos últimos ${commits.length} ${commits.length === 1 ? 'commit' : 'commits'} de ${props.repo}`"
      >
        <defs>
          <!-- marcador "continua" das arestas clipadas (pais fora da janela) -->
          <marker id="cg-continua" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" :fill="ct.textDim" />
          </marker>
        </defs>

        <!-- faixas das linhas com o ref ativo -->
        <rect
          v-for="row in view.rows.filter(x => x.refHit)"
          :key="`band-${row.hash}`"
          class="cg-band"
          x="0"
          :y="row.y"
          :width="layout.totalW"
          :height="ROW_H"
        />

        <!-- arestas -->
        <line
          v-for="(s, k) in view.segs"
          :key="`s${k}`"
          class="cg-edge"
          :class="edgeClass(s.laneId, s.clipped)"
          :x1="s.x1"
          :y1="s.y1"
          :x2="s.x2"
          :y2="s.y2"
          :stroke="s.color"
          :marker-end="s.clipped ? 'url(#cg-continua)' : undefined"
        />
        <path
          v-for="(cv, k) in view.curves"
          :key="`c${k}`"
          class="cg-edge"
          :class="edgeClass(cv.laneId, cv.clipped)"
          :d="cv.d"
          :stroke="cv.color"
          :marker-end="cv.clipped ? 'url(#cg-continua)' : undefined"
        />

        <!-- linhas: âncora p/ o GitHub + círculo + textos -->
        <a
          v-for="row in view.rows"
          :key="row.hash"
          :href="row.href ?? undefined"
          target="_blank"
          rel="noopener"
          class="cg-row"
          :class="{ dim: row.dim }"
          @mouseenter="showTip($event, row)"
          @mouseleave="hideTip"
        >
          <rect class="cg-rowbg" x="0" :y="row.y" :width="layout.totalW" :height="ROW_H" />
          <circle
            class="cg-dot"
            :cx="row.cx"
            :cy="row.cy"
            :r="DOT_R"
            :fill="row.merge ? ct.elevated : row.color"
            :stroke="row.merge ? row.color : row.refHit ? ct.text : undefined"
            :stroke-width="row.merge ? 2 : row.refHit ? 1.5 : undefined"
          />
          <text class="cg-subject" :x="layout.textX" :y="row.cy" :fill="ct.text" :style="{ font: SUBJECT_FONT }" dominant-baseline="central">
            {{ row.subject }}
          </text>
          <g v-for="(chip, k) in row.chips" :key="`chip-${k}`">
            <rect :x="chip.x" :y="row.cy - 7" :width="chip.w" :height="14" rx="3" :fill="chip.color" opacity="0.16" />
            <text :x="chip.x + 5" :y="row.cy" :fill="chip.color" :style="{ font: CHIP_FONT }" dominant-baseline="central">
              {{ chip.label }}
            </text>
          </g>
          <text :x="layout.authorX" :y="row.cy" :fill="ct.textDim" :style="{ font: META_FONT }" dominant-baseline="central">
            {{ row.author }}
          </text>
          <text :x="layout.dateX" :y="row.cy" :fill="ct.textDim" :style="{ font: META_FONT }" dominant-baseline="central">
            {{ row.date }}
          </text>
        </a>
      </svg>

      <div class="flex items-center gap-3 px-4 py-2 border-t border-default">
        <UButton
          v-if="shownCount < commits.length"
          size="xs"
          color="neutral"
          variant="outline"
          icon="i-lucide-history"
          @click="showMore"
        >
          Mostrar mais antigos
        </UButton>
        <span class="text-dimmed text-xs">
          mostrando {{ shownCount }} de {{ commits.length }} {{ commits.length === 1 ? 'commit' : 'commits' }} da janela
        </span>
      </div>

      <p class="text-dimmed text-xs px-4 pb-3 leading-relaxed">
        últimos {{ commits.length }} {{ commits.length === 1 ? 'commit' : 'commits' }} · ~{{ windowDays }} dias · merges são conectores do desenho (métricas seguem sem merges)
        · janela fixa: não segue os filtros de período/bots/escopo
        <template v-if="view.clippedCount">
          · {{ view.clippedCount }} {{ view.clippedCount === 1 ? 'aresta tracejada com seta: pai fora da janela' : 'arestas tracejadas com seta: pais fora da janela' }} — a história continua mais antigo
        </template>
      </p>

      <!-- tooltip (um só, posicionado no hover) -->
      <div v-if="tip" class="cg-tip" :style="{ left: `${tip.x}px`, top: `${tip.y}px` }" role="tooltip">
        <div class="text-xs font-semibold leading-snug break-words">
          {{ tip.subject }}
        </div>
        <div class="text-[11px] text-muted mt-1">
          {{ tip.author }} · {{ tip.date }}
        </div>
        <div v-if="tip.refs" class="text-[11px] text-dimmed mt-0.5">
          ({{ tip.refs }})
        </div>
        <code class="text-[10px] text-dimmed">{{ tip.hash }}</code>
      </div>
    </div>
  </TablePanel>
</template>

<style scoped>
.cg-svg a {
  cursor: pointer;
}
.cg-rowbg {
  fill: transparent;
}
.cg-svg a:hover .cg-rowbg {
  fill: color-mix(in oklab, var(--ui-primary) 9%, transparent);
}
.cg-edge {
  stroke-width: 2;
  fill: none;
  stroke-linecap: round;
}
/* parent fora da janela: tracejado + opacidade (geometria do spike #125) */
.cg-clipped {
  stroke-dasharray: 3 3;
  opacity: 0.65;
}
.cg-dim {
  opacity: 0.12;
}
.cg-hl {
  stroke-width: 2.8;
}
.cg-band {
  fill: var(--ui-primary);
  opacity: 0.08;
}
.cg-row.dim {
  opacity: 0.35;
}
.cg-subject {
  pointer-events: none;
}
.cg-tip {
  position: absolute;
  z-index: 30;
  max-width: 420px;
  padding: 8px 10px;
  border: 1px solid var(--ui-border);
  border-radius: 8px;
  background: var(--ui-bg-elevated);
  box-shadow: 0 8px 24px rgb(0 0 0 / 0.35);
  pointer-events: none;
}
.cg-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  border: 1px solid var(--ui-border);
  border-radius: 999px;
  background: var(--ui-bg-elevated);
  font-size: 11px;
  color: var(--ui-text-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.cg-chip:hover {
  color: var(--ui-text);
  border-color: var(--ui-border-accented);
}
.cg-chip.active {
  color: var(--ui-text-highlighted);
  border-color: var(--ui-primary);
}
</style>
