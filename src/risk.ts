/**
 * Padrão "risk bar" compartilhado (issue #36): antes a lógica de status
 * (barra colorida + badge) estava copiada em 5 painéis (BusFactor,
 * FixHotspots, ReviewBottleneck, OffHoursPanel, ReviewCoverage), com larguras
 * e regras divergentes. Os limiares continuam em `thresholds.ts`/nos painéis;
 * aqui fica só a resolução do status — `RiskBar.vue` renderiza a barra.
 */

/** nível de risco exibido (cor do badge UBadge + cor da barra) */
export type RiskLevel = 'error' | 'warning' | 'success'

export interface RiskStatus {
  color: RiskLevel
  label: string
  /** cor CSS do preenchimento da barra (tokens do tema) */
  hex: string
}

export interface RiskTier {
  /** patamar mínimo no eixo do `pct` (mesma escala do valor passado) */
  at: number
  color: RiskLevel
  label: string
}

/** cor da barra por nível — tokens do Nuxt UI */
const RISK_HEX: Record<RiskLevel, string> = {
  error: 'var(--ui-error)',
  warning: 'var(--ui-warning)',
  success: 'var(--ui-success)',
}

/**
 * Resolve o status do `pct` nos `tiers`: os patamares são avaliados do maior
 * `at` para o menor e o primeiro com `pct >= at` vence (o menor tier é o
 * fallback para `pct` fora da escala).
 */
export function statusOf(pct: number, tiers: RiskTier[]): RiskStatus {
  const sorted = [...tiers].sort((a, b) => b.at - a.at)
  const tier = sorted.find(t => pct >= t.at) ?? sorted[sorted.length - 1]
  // sem tiers não há o que resolver — devolve o nível neutro
  if (!tier)
    return { color: 'success', label: 'ok', hex: RISK_HEX.success }
  return { color: tier.color, label: tier.label, hex: RISK_HEX[tier.color] }
}
