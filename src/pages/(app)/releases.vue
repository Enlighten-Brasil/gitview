<script setup lang="ts">
/**
 * Releases dedicado — tags e notas por repositório (o resto das métricas de
 * release fica nas páginas de repo). Não usa filtro de período: são marcos.
 */
import { computed } from 'vue'
import { releases, releasesError } from '@/releases'

definePage({
  meta: {
    section: 'releases',
    filters: 'none',
    title: 'Releases',
  },
})

const rows = computed(() => releases.value?.repos ?? [])
</script>

<template>
  <div class="flex flex-col gap-4 p-4 sm:p-6 max-w-5xl mx-auto w-full">
    <p class="text-sm text-dimmed">
      Tags e notas de release por repositório — clique no repo para ver a cadência completa.
    </p>
    <!-- skeleton enquanto o releases.json chega; sem dado/erro → instrução -->
    <div v-if="!releases && !releasesError" class="grid gap-3 md:grid-cols-2">
      <USkeleton v-for="i in 4" :key="i" class="h-24 rounded-lg" />
    </div>
    <p v-else-if="!rows.length || releasesError" class="text-sm text-dimmed">
      Sem dados de release — rode <code>pnpm collect:releases</code> (ou ↻ no navbar).
    </p>
    <div v-else class="grid gap-3 md:grid-cols-2">
      <UCard v-for="r in rows" :key="r.repo">
        <RouterLink :to="{ name: '/repos/[name]', params: { name: r.repo } }" class="flex items-center gap-2 hover:text-primary">
          <UIcon name="i-lucide-tag" class="size-4 text-primary shrink-0" />
          <span class="font-medium">{{ r.repo }}</span>
          <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto">
            {{ r.tags.length }} tags
          </UBadge>
        </RouterLink>
        <div class="mt-2 text-xs text-dimmed">
          {{ r.tags[0]?.name ?? r.tags[0]?.tag ?? '— sem tags —' }}
        </div>
      </UCard>
    </div>
  </div>
</template>
