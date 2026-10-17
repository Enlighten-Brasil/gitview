<script setup lang="ts">
/**
 * Card de métrica compartilhado (ícone + valor + label) — o stat-card que estava
 * copiado em 4 lugares; o grid vem da classe global `.cards-grid` (main.css).
 */
defineProps<{
  value: string
  label: string
  icon?: string
  /** classe de cor do ícone (padrão neutro) */
  color?: string
  /** nota secundária após o label (" · 3 rascunhos") */
  sub?: string
  /** delta vs janela anterior (flecha + %; cor/tooltip vindos do consumidor) */
  delta?: {
    pct: number
    dir: 'up' | 'down' | 'flat'
    /** classe de cor do delta (nem toda subida é boa) */
    class?: string
    /** tooltip explicando a janela de comparação */
    tooltip?: string
  }
}>()
</script>

<template>
  <div class="stat-card">
    <div class="flex items-center gap-2">
      <UIcon v-if="icon" :name="icon" class="size-4" :class="color ?? 'text-muted'" />
      <span class="text-2xl font-bold tracking-tight truncate">{{ value }}</span>
    </div>
    <div class="text-xs text-muted mt-1">
      {{ label }}<span v-if="sub" class="text-dimmed"> · {{ sub }}</span>
      <UTooltip v-if="delta" :text="delta.tooltip">
        <span class="ml-1 font-semibold" :class="delta.class">
          <template v-if="delta.dir === 'up'">↑ {{ delta.pct }}%</template>
          <template v-else-if="delta.dir === 'down'">↓ {{ delta.pct }}%</template>
          <template v-else>→ {{ delta.pct }}%</template>
        </span>
      </UTooltip>
    </div>
  </div>
</template>
