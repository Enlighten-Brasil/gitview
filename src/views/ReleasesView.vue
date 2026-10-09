<script setup lang="ts">
/**
 * Releases dedicado — placeholder da seção (cadência/últimas ficam na Visão geral
 * até a migração). Lista os dados já carregados pelo loader global.
 */
import { computed } from 'vue'
import { releases } from '../releases'

const rows = computed(() => releases.value?.repos ?? [])
</script>

<template>
  <div class="flex flex-col gap-4 p-4 sm:p-6 max-w-5xl mx-auto w-full">
    <div>
      <h1 class="text-xl font-semibold">
        Releases
      </h1>
      <p class="text-sm text-dimmed">
        Tags e notas por repositório. Cadência completa segue na aba Visão geral até a migração.
      </p>
    </div>
    <div class="grid gap-3 md:grid-cols-2">
      <UCard v-for="r in rows" :key="r.repo">
        <div class="flex items-center gap-2">
          <UIcon name="i-lucide-tag" class="size-4 text-primary shrink-0" />
          <span class="font-medium">{{ r.repo }}</span>
          <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto">
            {{ r.tags.length }} tags
          </UBadge>
        </div>
        <div class="mt-2 text-xs text-dimmed">
          {{ r.tags[0]?.name ?? r.tags[0]?.tag ?? '— sem tags —' }}
        </div>
      </UCard>
    </div>
  </div>
</template>
