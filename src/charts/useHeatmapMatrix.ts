/**
 * Matriz de heatmap compartilhada (issue #35): agregação em Map de chave
 * composta → dados `[x, y, v]` → tooltip formatter → visualMap com
 * `Math.max(max, 1)` → série heatmap. Os 4 heatmaps do app (ActivityHeatmap,
 * AuthorMonthHeatmap, RepoMonthHeatmap e o bloco do perfil do dev) passam a
 * descrever só o que muda: linhas, chaves, rampa, ordenação e tooltip.
 */
import type { EChartsOption } from 'echarts'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { axisLabel, ct, heatRamp, tooltipBase } from '../chartTheme'
import { fmtWeekdays } from '../format'
import { getComposer } from '../i18n'

/** valor de categoria de um eixo: rótulo textual ou índice numérico */
export type HeatValue = string | number

/** ordenação de um eixo: lista explícita de categorias ou estratégia sobre os valores observados */
export type HeatOrder = readonly HeatValue[] | 'alpha' | 'numeric' | 'volume'

export interface HeatmapMatrixConfig<T extends { commits: number }> {
  /** linhas de origem (já filtradas); a agregação soma `valueKey` por (x, y) */
  rows: MaybeRefOrGetter<readonly T[]>
  xKey: keyof T & string
  yKey: keyof T & string
  /** campo somado na célula (default: `commits`) */
  valueKey?: keyof T & string
  ramp: 'primary' | 'success' | 'violet'
  /** ordem dos eixos (default: `alpha` sobre os valores observados) */
  order?: { x?: HeatOrder, y?: HeatOrder }
  /** rótulo do eixo x (default: `String`) */
  xLabel?: (value: HeatValue) => string
  /** rótulo do eixo y (default: `String`) */
  yLabel?: (value: HeatValue) => string
  /** tooltip da célula, com os valores brutos das categorias (default: `<y> — <x>: <v> commits`) */
  formatTip?: (x: HeatValue, y: HeatValue, value: number) => string
  grid?: EChartsOption['grid']
  /** rotação dos rótulos do eixo x (default: reto) */
  xRotate?: number
  /** legenda visualMap visível (default: true) */
  visualMap?: boolean
}

/** resolve a ordem de um eixo: lista explícita ou estratégia sobre os valores observados */
function orderedValues(order: HeatOrder | undefined, observed: Map<HeatValue, number>): HeatValue[] {
  if (Array.isArray(order))
    return [...order]
  const values = [...observed.keys()]
  // 'volume': soma decrescente — quem mais commita fica no topo (sort é estável)
  if (order === 'volume')
    return values.sort((a, b) => (observed.get(b) ?? 0) - (observed.get(a) ?? 0))
  if (order === 'numeric')
    return values.sort((a, b) => Number(a) - Number(b))
  return values.sort()
}

/** acessa o valor de categoria de uma linha (as chaves são escolhidas no chamador) */
function cellValue<T extends { commits: number }>(row: T, key: keyof T & string): HeatValue {
  return row[key] as unknown as HeatValue
}

export function useHeatmapMatrix<T extends { commits: number }>(config: HeatmapMatrixConfig<T>): ComputedRef<EChartsOption> {
  return computed<EChartsOption>(() => {
    // `t` resolve aqui (na montagem da opção): o tooltip fecha sobre ele e o
    // computed se reavalia quando o locale troca (xLabel/yLabel rodam no build)
    const { t } = getComposer()
    const rows = toValue(config.rows)
    const valueKey = (config.valueKey ?? 'commits') as keyof T & string

    // agregação em Map de chave composta x|y — soma células repetidas
    const cells = new Map<string, { x: HeatValue, y: HeatValue, v: number }>()
    const xTotals = new Map<HeatValue, number>()
    const yTotals = new Map<HeatValue, number>()
    for (const r of rows) {
      const x = cellValue(r, config.xKey)
      const y = cellValue(r, config.yKey)
      const v = cellValue(r, valueKey) as number
      const k = `${x}\u0000${y}`
      const cell = cells.get(k)
      if (cell)
        cell.v += v
      else
        cells.set(k, { x, y, v })
      xTotals.set(x, (xTotals.get(x) ?? 0) + v)
      yTotals.set(y, (yTotals.get(y) ?? 0) + v)
    }

    const xs = orderedValues(config.order?.x, xTotals)
    const ys = orderedValues(config.order?.y, yTotals)
    const xIndex = new Map(xs.map((v, i) => [v, i]))
    const yIndex = new Map(ys.map((v, i) => [v, i]))

    // dados [x, y, v] em índices de categoria; células fora da ordem explícita caem fora
    const data: [number, number, number][] = []
    let max = 0
    for (const cell of cells.values()) {
      const x = xIndex.get(cell.x)
      const y = yIndex.get(cell.y)
      if (x === undefined || y === undefined)
        continue
      data.push([x, y, cell.v])
      if (cell.v > max)
        max = cell.v
    }

    const xLabel = config.xLabel ?? String
    const yLabel = config.yLabel ?? String
    // `<b>` é marcação do tooltip ECharts e fica no código: o unplugin-vue-i18n
    // rejeita HTML no catálogo (strictMessage) e derrubaria o `pnpm build`
    const formatTip = config.formatTip ?? ((x, y, v) => `${t('chart.heat.tip', { y, x })} <b>${v}</b> ${t('chart.commits')}`)

    // visualMap: legenda completa; `visualMap: false` (perfil do dev) mantém só o
    // mapeamento de cor — a célula de meia largura não comporta a legenda vertical
    const visualMap: EChartsOption['visualMap'] = config.visualMap === false
      ? { min: 0, max: Math.max(max, 1), show: false, inRange: { color: heatRamp(config.ramp) } }
      : {
          min: 0,
          max: Math.max(max, 1),
          calculable: true,
          orient: 'vertical',
          right: 0,
          top: 'center',
          inRange: { color: heatRamp(config.ramp) },
          textStyle: { color: ct.text },
        }

    return {
      tooltip: tooltipBase({
        formatter: (p: unknown) => {
          const d = (p as { data: [number, number, number] }).data
          return formatTip(xs[d[0]], ys[d[1]], d[2])
        },
      }),
      grid: config.grid ?? { left: 130, right: 60, top: 10, bottom: 60 },
      xAxis: {
        type: 'category',
        data: xs.map(xLabel),
        axisLabel: axisLabel(config.xRotate ? { rotate: config.xRotate } : undefined),
      },
      yAxis: { type: 'category', data: ys.map(yLabel), axisLabel: axisLabel() },
      visualMap,
      series: [{ type: 'heatmap', data }],
    }
  })
}

/** linhas do heatmap de horários — shape mínimo agregado pela matriz */
export interface WeekdayHourRow {
  weekday: number
  hour: number
  commits: number
}

/**
 * Heatmap dia-da-semana × hora (ActivityHeatmap e perfil do dev): categorias
 * fixas do relógio (24h × 7 dias, mesmo sem dados) e tooltip com hora zerada.
 */
export function useWeekdayHourHeatmap(params: {
  rows: MaybeRefOrGetter<readonly WeekdayHourRow[]>
  grid?: EChartsOption['grid']
  visualMap?: boolean
}): ComputedRef<EChartsOption> {
  // `t` p/ rótulo de eixo e tooltip — chamados na montagem da opção (o eixo x
  // ainda dá a dependência reativa de locale ao computed)
  const { t } = getComposer()
  return useHeatmapMatrix<WeekdayHourRow>({
    rows: params.rows,
    xKey: 'hour',
    yKey: 'weekday',
    ramp: 'success',
    order: {
      x: Array.from({ length: 24 }, (_, h) => h),
      y: fmtWeekdays().map((_, i) => i),
    },
    xLabel: h => t('chart.heat.hour', { h }),
    yLabel: d => fmtWeekdays()[Number(d)],
    formatTip: (x, y, v) => {
      const weekday = fmtWeekdays()[Number(y)]
      const hour = String(x).padStart(2, '0')
      return `${t('chart.heat.hourTip', { weekday, hour })} <b>${v}</b> ${t('chart.commits')}`
    },
    grid: params.grid ?? { left: 50, right: params.visualMap === false ? 20 : 60, top: 10, bottom: 30 },
    visualMap: params.visualMap,
  })
}
