<script setup lang="ts">
/**
 * Painel de tabela compartilhado — o wrapper (UCard com body `p-0 sm:p-0` +
 * header com ícone/título/badge de contagem) que estava copiado em ~8 lugares.
 * O conteúdo da tabela vem pelo slot default; ações extras no header pelo slot
 * `actions` (mesmo padrão do ChartPanel).
 */
defineProps<{
  title: string
  icon?: string
  /** classe de cor do ícone (cada painel tem a sua) */
  iconClass?: string
  /** badge de contagem no header (omitido quando não faz sentido) */
  count?: number
}>()
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0', header: 'py-3 px-4 sm:px-4' }">
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon v-if="icon" :name="icon" class="size-4 shrink-0" :class="iconClass ?? 'text-primary'" />
        <span class="text-sm font-semibold text-highlighted">{{ title }}</span>
        <span class="ml-auto flex items-center gap-1.5">
          <slot name="actions" />
          <UBadge v-if="count != null" color="neutral" variant="subtle" size="sm">
            {{ count }}
          </UBadge>
        </span>
      </div>
    </template>
    <slot />
  </UCard>
</template>
