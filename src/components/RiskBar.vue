<script setup lang="ts">
import type { RiskStatus } from '../risk'

/**
 * Barra de risco padronizada (issue #36) — antes o track + fill + % estavam
 * copiados em 5 painéis com larguras divergentes. A largura da célula fica no
 * uso (classe passada via attrs); o status vem de `statusOf(pct, tiers)`.
 */
defineProps<{
  /** fração 0–1 preenchida na barra */
  pct: number
  /** status resolvido por `statusOf` (cor do preenchimento) */
  status: RiskStatus
  /** mostra o % à direita (tabelas com coluna própria de % deixam false) */
  showValue?: boolean
}>()
</script>

<template>
  <div class="flex items-center gap-2">
    <div class="h-2 flex-1 rounded bg-accented overflow-hidden">
      <div class="h-full rounded" :style="{ width: `${Math.round(pct * 100)}%`, background: status.hex }" />
    </div>
    <span v-if="showValue !== false" class="num text-xs w-9">{{ Math.round(pct * 100) }}%</span>
  </div>
</template>
