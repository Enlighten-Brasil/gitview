import type { EChartsOption } from 'echarts'

/**
 * Tema ECharts alinhado ao Nuxt UI.
 * Resolve as CSS vars do design system em runtime (com fallback p/ os hex
 * do tema default dark) — se a cor primária mudar no vite.config, os
 * gráficos acompanham sem tocar nos componentes.
 */

let cache: Record<string, string> | null = null

/** Converte `oklch(L C H)` → `#rrggbb` (ECharts/canvas não entende oklch). */
function oklchToHex(input: string): string {
  const m = input.match(/oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/)
  if (!m) return input
  const L = m[2] === '%' ? Number(m[1]) / 100 : Number(m[1])
  const C = Number(m[3])
  const hRad = (Number(m[4]) * Math.PI) / 180
  const a = C * Math.cos(hRad)
  const b = C * Math.sin(hRad)

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b
  const s_ = L - 0.0894841775 * a - 1.291485548 * b
  const l = l_ ** 3
  const m3 = m_ ** 3
  const s = s_ ** 3

  const toSrgb = (c: number) => {
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.round(Math.min(1, Math.max(0, g)) * 255).toString(16).padStart(2, '0')
  }
  const r = +4.0767416621 * l - 3.3077115913 * m3 + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m3 - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * m3 + 1.707614701 * s
  return `#${toSrgb(r)}${toSrgb(g)}${toSrgb(bl)}`
}

function resolve(): Record<string, string> {
  if (cache) return cache
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => {
    const raw = css.getPropertyValue(name).trim() || fallback
    return raw.startsWith('oklch') ? oklchToHex(raw) : raw
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

export const ct = new Proxy({} as ReturnType<typeof resolve>, {
  get: (_, key: string) => resolve()[key],
})

/** Paleta categórica (tons 400 do Tailwind) p/ séries empilhadas e pizzas. */
export const PALETTE = [
  '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee',
  '#a3e635', '#e879f9', '#fb923c', '#2dd4bf', '#818cf8', '#f472b6',
]

/** Rampa de heatmap: fundo → tom escuro → tom médio → tom claro. */
export function heatRamp(family: 'primary' | 'success' | 'violet'): string[] {
  const c = resolve()
  if (family === 'success') return [c.elevated, c.success900, c.success500, c.success300]
  if (family === 'violet') return [c.elevated, c.violet900, c.violet500, c.violet300]
  return [c.elevated, c.primary900, c.primary, c.primary300]
}

/** Tooltip base com cara de dropdown do Nuxt UI. */
export function tooltipBase(extra?: EChartsOption['tooltip']): EChartsOption['tooltip'] {
  const c = resolve()
  return {
    backgroundColor: c.elevated,
    borderColor: c.border,
    textStyle: { color: '#e2e8f0', fontSize: 12 },
    ...extra,
  } as EChartsOption['tooltip']
}

/** axisLabel/legend/splitLine prontos nos tokens do tema. */
export function axisLabel(extra?: object) {
  return { color: ct.text, ...extra }
}
export function splitLine() {
  return { lineStyle: { color: ct.borderMuted } }
}
export function legendText() {
  return { color: ct.text }
}
