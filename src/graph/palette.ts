import type { Ref } from 'vue'
import type { ProgressScope } from '../types'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { PALETTE } from '../chartTheme'

/**
 * Paletas do grafo de commits (issue #127 — números medidos no spike #125):
 *
 * - tema ESCURO: as cores da PALETTE (chartTheme.ts, tons 400) na ordem
 *   gulosa de matiz VALIDADA no spike (vizinhas ≥ 146,6° — na ordem original
 *   o pior par adjacente fica a 64,9°). Derivada por ÍNDICES da PALETTE: se
 *   a fonte mudar, o grafo acompanha (a ordem é permutação das mesmas 12).
 * - tema CLARO: tons 600 das mesmas famílias na mesma ordem — os tons 400 da
 *   PALETTE reprovam contraste WCAG 3:1 em 12/12 sobre branco (mín 1,51:1);
 *   o conjunto 600 mede mín 3,09:1, zero reprovações.
 *
 * `laneColor(branch, scopeMap?)` já aceita o mapa de escopo por ref p/ as
 * cores semânticas por eixo de trabalho quando o workScope chegar na UI
 * (#129) — a assinatura do renderer não muda depois.
 */

/**
 * Conjunto do tema claro (tons 600 medidos no spike #125 — mín 3,09:1 vs
 * #ffffff), na ordem de famílias do dark: blue, amber, indigo, orange, cyan,
 * red, teal, pink, emerald, fuchsia, lime, violet.
 */
export const GRAPH_LANE_LIGHT = [
  '#2563eb',
  '#d97706',
  '#4f46e5',
  '#ea580c',
  '#0891b2',
  '#dc2626',
  '#0d9488',
  '#db2777',
  '#059669',
  '#c026d3',
  '#65a30d',
  '#7c3aed',
]

/**
 * PALETTE na ordem gulosa de matiz do spike #125 (índices: #60a5fa #fbbf24
 * #818cf8 #fb923c #22d3ee #f87171 #2dd4bf #f472b6 #34d399 #e879f9 #a3e635
 * #a78bfa — distância mínima entre vizinhas 146,6°).
 */
const DARK_ORDER = [0, 2, 10, 8, 5, 4, 9, 11, 1, 7, 6, 3]

/** paleta dark do grafo — permutação da PALETTE (fonte única: chartTheme.ts) */
export const GRAPH_LANE_DARK = DARK_ORDER.map(i => PALETTE[i % PALETTE.length])

/** tema ativo: Nuxt UI (color-mode) aplica a classe `dark` no <html>; fallback = preferência do sistema */
export function isDarkTheme(): boolean {
  if (typeof document === 'undefined')
    return true
  const cls = document.documentElement.classList
  if (cls.contains('dark'))
    return true
  if (cls.contains('light'))
    return false
  return typeof matchMedia === 'undefined' ? true : !matchMedia('(prefers-color-scheme: light)').matches
}

/**
 * Cor de uma lane/branch (índice estável do algoritmo de lanes), com wrap no
 * tamanho da paleta (janelas reais chegam a ~19 colunas com 12 cores).
 * `scopeMap` (ref → escopo de trabalho) está reservado p/ cores semânticas
 * por eixo (#129): aceito e ignorado na v1 para a assinatura já estar pronta.
 */
export function laneColor(branch: number, scopeMap?: Record<string, ProgressScope> | null): string {
  void scopeMap
  const pal = isDarkTheme() ? GRAPH_LANE_DARK : GRAPH_LANE_LIGHT
  return pal[((branch % pal.length) + pal.length) % pal.length]
}

/** cor de chip de ref por tipo (tema-aware; contraste ok nos dois fundos) */
export function refColor(type: 'HEAD' | 'branch' | 'tag' | 'remote'): string {
  const dark = isDarkTheme()
  switch (type) {
    case 'HEAD':
      return dark ? '#4ade80' : '#15803d'
    case 'branch':
      return dark ? '#60a5fa' : '#2563eb'
    case 'tag':
      return dark ? '#fbbf24' : '#b45309'
    case 'remote':
      return dark ? '#94a3b8' : '#64748b'
  }
}

/**
 * Reatividade de tema: a escolha dark/light vem do DOM (classe no <html> /
 * prefers-color-scheme), que o Vue não observa — este composable bumpa um
 * `version` a cada mudança (classe ou media) para os computeds de cor
 * recalcularem. O chamador liga/desliga com useThemeLifecycle.
 */
export function useThemeVersion(): Ref<number> {
  const version = ref(0)
  onMounted(() => {
    if (typeof matchMedia === 'undefined')
      return
    const bump = () => {
      version.value++
    }
    const mq = matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', bump)
    const mo = new MutationObserver(bump)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    onBeforeUnmount(() => {
      mq.removeEventListener('change', bump)
      mo.disconnect()
    })
  })
  return version
}
