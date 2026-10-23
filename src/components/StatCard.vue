<script setup lang="ts">
/**
 * Card de métrica compartilhado (ícone + valor + label) — o stat-card que estava
 * copiado em 4 lugares; o grid vem da classe global `.cards-grid` (main.css).
 */
import { useI18n } from 'vue-i18n'

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

const { t } = useI18n({ useScope: 'global' })
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
        <span class="ml-1 inline-flex items-center gap-0.5 font-semibold" :class="delta.class">
          <UIcon
            :name="delta.dir === 'up' ? 'i-lucide-arrow-up' : delta.dir === 'down' ? 'i-lucide-arrow-down' : 'i-lucide-arrow-right'"
            class="size-3"
          />
          {{ t('ui.pct', { n: delta.pct }) }}
        </span>
      </UTooltip>
    </div>
  </div>
</template>
