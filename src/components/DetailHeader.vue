<script setup lang="ts">
import { rangeLabel } from '../data'

/**
 * Cabeçalho compartilhado das páginas de detalhe (issue #41) — o bloco
 * "voltar + ícone + título + período" que estava espelhado em devs/[name] e
 * repos/[name]. Extras do título (ex.: link do GitHub) vão no slot default.
 */
defineProps<{
  /** rota do botão voltar */
  to: string
  backLabel: string
  icon: string
  title: string
}>()
</script>

<template>
  <div class="flex items-center gap-3 flex-wrap">
    <UButton
      :to="to"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="ghost"
      size="sm"
      :label="backLabel"
    />
    <UIcon :name="icon" class="size-6 text-primary" />
    <h1 class="text-xl font-bold text-highlighted">
      {{ title }}
    </h1>
    <slot />
    <span class="text-xs text-dimmed">— {{ rangeLabel }}</span>
  </div>
</template>
