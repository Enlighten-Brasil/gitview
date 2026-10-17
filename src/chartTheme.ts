import type { EChartsOption, LegendComponentOption, PieSeriesOption, TooltipComponentOption, YAXisComponentOption } from 'echarts'

/**
 * Tema ECharts alinhado ao Nuxt UI.
 * Resolve as CSS vars do design system em runtime (com fallback p/ os hex
 * do tema default dark) — se a cor primária mudar no vite.config, os
 * gráficos acompanham sem tocar nos componentes.
 */

let cache: Record<string, string> | null = null

/** fallback hex usado quando o valor CSS não é um `oklch(...)` conversível */
const OKLCH_FALLBACK = '#888888'

/**
 * Lê um componente numérico do oklch: `none` (→ 0, exceto alpha que → 1) e
 * unidade opcional (`%` em L/C/alpha, `deg|grad|rad|turn` no matiz). Token
 * inválido devolve `null` e derruba a conversão para o fallback hex.
 */
function parseToken(token: string, kind: 'l' | 'c' | 'h' | 'a'): number | null {
  const t = token.trim().toLowerCase()
  if (t === 'none')
    return kind === 'a' ? 1 : 0
  const m = t.match(/^([+-]?[\d.]+)(%|deg|grad|rad|turn)?$/)
  if (!m || !m[1] || m[1] === '.' || m[1] === '+' || m[1] === '-')
    return null
  const value = Number(m[1])
  if (Number.isNaN(value))
    return null
  if (m[2] === '%')
    return kind === 'c' ? (value / 100) * 0.4 : value / 100 // C% é relativo a 0.4
  if (kind === 'h') {
    if (m[2] === 'grad')
      return value * 0.9
    if (m[2] === 'rad')
      return (value * 180) / Math.PI
    if (m[2] === 'turn')
      return value * 360
    return value
  }
  return m[2] ? null : value
}

/**
 * Converte `oklch(L C H [/ alpha])` → `#rrggbb` (ou `#rrggbbaa` com alpha —
 * hex8 que o zrender/ECharts aceita). O canvas não entende oklch, e a
 * conversão cobre `none`, unidades de matiz e alpha. Hex pronto passa direto;
 * qualquer entrada que não case a conversão (`color-mix(...)`, keyword,
 * formato inesperado…) vira o `fallback` hex — a saída **nunca** contém
 * `oklch(` cru.
 */
export function oklchToHex(input: string, fallback = OKLCH_FALLBACK): string {
  const trimmed = input.trim()
  if (/^#[0-9a-f]{3,8}$/i.test(trimmed))
    return trimmed
  if (!/oklch/i.test(trimmed))
    return fallback // sem oklch não há o que converter — vira o fallback hex
  const m = trimmed.match(/^oklch\((.*)\)$/i)
  if (!m)
    return fallback
  const inner = m[1]
  const slash = inner.indexOf('/')
  const mainPart = (slash === -1 ? inner : inner.slice(0, slash)).trim()
  const alphaPart = slash === -1 ? undefined : inner.slice(slash + 1).trim()
  const parts = mainPart.split(/\s+/)
  if (parts.length !== 3)
    return fallback
  const L = parseToken(parts[0], 'l')
  const C = parseToken(parts[1], 'c')
  const H = parseToken(parts[2], 'h')
  const alpha = alphaPart === undefined ? 1 : parseToken(alphaPart, 'a')
  if (L === null || C === null || H === null || alpha === null)
    return fallback

  const hRad = (H * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m3 = m_ ** 3
  const s = s_ ** 3

  const toByteHex = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
  const toSrgb = (c: number) => {
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return toByteHex(g)
  }
  const r = +4.0767416621 * l - 3.3077115913 * m3 + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m3 - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * m3 + 1.707614701 * s
  const hex = `#${toSrgb(r)}${toSrgb(g)}${toSrgb(bl)}`
  return alpha >= 1 ? hex : `${hex}${toByteHex(alpha)}` // hex8 com alpha embutido
}

function resolve(): Record<string, string> {
  if (cache)
    return cache
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => {
    const raw = css.getPropertyValue(name).trim()
    if (!raw)
      return fallback
    // qualquer valor que carregue oklch passa pelo conversor — que devolve
    // hex ou o fallback; `oklch(` cru nunca chega ao ECharts
    return /oklch/i.test(raw) ? oklchToHex(raw, fallback) : raw
  }
  cache = {
    text: v('--ui-text-muted', '#9aa3b2'),
    textDim: v('--ui-text-dimmed', '#6b7280'),
    border: v('--ui-border', '#262b36'),
    borderMuted: v('--ui-border-muted', '#1f2430'),
    bg: v('--ui-bg', '#0f172a'),
    elevated: v('--ui-bg-elevated', '#171a21'),
    primary: v('--ui-color-primary-500', '#3b82f6'),
    primary900: v('--ui-color-primary-900', '#1e3a8a'),
    primary300: v('--ui-color-primary-300', '#93c5fd'),
    success500: v('--ui-color-success-500', '#22c55e'),
    success900: v('--ui-color-success-900', '#14532d'),
    success300: v('--ui-color-success-300', '#86efac'),
    violet500: v('--ui-color-violet-500', '#8b5cf6'),
    violet900: v('--ui-color-violet-900', '#4c1d95'),
    violet300: v('--ui-color-violet-300', '#c4b5fd'),
    error500: v('--ui-color-error-500', '#ef4444'),
    warning500: v('--ui-color-warning-500', '#f59e0b'),
  }
  return cache
}

/**
 * Zera o cache de cores do tema. As CSS vars são lidas do CSSOM uma única vez
 * (proxy `ct`) — chame depois de trocar o design system em runtime (ex.:
 * mudança de tema/variáveis) para os próximos gráficos re-resolverem as cores.
 */
export function resetThemeCache(): void {
  cache = null
}

export const ct = new Proxy({} as ReturnType<typeof resolve>, {
  get: (_, key: string) => resolve()[key],
})

/** Paleta categórica (tons 400 do Tailwind) p/ séries empilhadas e pizzas. */
export const PALETTE = [
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#a78bfa',
  '#f87171',
  '#22d3ee',
  '#a3e635',
  '#e879f9',
  '#fb923c',
  '#2dd4bf',
  '#818cf8',
  '#f472b6',
]

/** Rampa de heatmap: fundo → tom escuro → tom médio → tom claro. */
export function heatRamp(family: 'primary' | 'success' | 'violet'): string[] {
  const c = resolve()
  if (family === 'success')
    return [c.elevated, c.success900, c.success500, c.success300]
  if (family === 'violet')
    return [c.elevated, c.violet900, c.violet500, c.violet300]
  return [c.elevated, c.primary900, c.primary, c.primary300]
}

/** Tooltip base com cara de dropdown do Nuxt UI. */
export function tooltipBase(extra?: TooltipComponentOption): TooltipComponentOption {
  const c = resolve()
  return {
    backgroundColor: c.elevated,
    borderColor: c.border,
    textStyle: { color: '#e2e8f0', fontSize: 12 },
    ...extra,
  }
}

/** axisLabel/legend/splitLine prontos nos tokens do tema. */
// `type`/`formatter` abertos: o mesmo helper serve p/ eixo de categoria e de valor
type AxisLabelOption = Omit<NonNullable<YAXisComponentOption['axisLabel']>, 'type' | 'formatter'> & {
  formatter?: string | ((value: string | number, index: number) => string)
}
export function axisLabel(extra?: AxisLabelOption): AxisLabelOption {
  return { color: ct.text, ...extra }
}
export function splitLine(): NonNullable<YAXisComponentOption['splitLine']> {
  return { lineStyle: { color: ct.borderMuted } }
}
export function legendText(): NonNullable<LegendComponentOption['textStyle']> {
  return { color: ct.text }
}

/** fatia do donut — `color` sobrepõe a paleta (ex.: tipos de commit) */
export interface DonutSlice {
  name: string
  value: number
  color?: string
}

/**
 * Donut compartilhado (issue #36) — a config (tooltip/legenda/raio/borda do
 * item) estava copiada em RepoShare, devs/[name] e repos/[name], com centros
 * divergentes (40% vs 38%). Os chamadores passam só as fatias.
 */
export function donutBase(slices: DonutSlice[], opts: { center?: [string, string] } = {}): EChartsOption {
  const pie: PieSeriesOption = {
    type: 'pie',
    radius: ['45%', '75%'],
    center: opts.center ?? ['38%', '50%'],
    itemStyle: { borderColor: ct.bg, borderWidth: 2 },
    label: { show: false },
    data: slices.map(s => s.color
      ? { name: s.name, value: s.value, itemStyle: { color: s.color } }
      : { name: s.name, value: s.value }),
  }
  return {
    color: PALETTE,
    tooltip: tooltipBase({ trigger: 'item', formatter: '{b}: {c} commits ({d}%)' }),
    legend: { type: 'scroll', orient: 'vertical', right: 0, top: 'middle', textStyle: legendText() },
    series: [pie],
  }
}
