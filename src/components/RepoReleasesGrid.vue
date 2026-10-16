<script setup lang="ts">
/**
 * Releases por repositório — grade dentro de /repos (a página dedicada virou
 * seção aqui: a tabela de repos já mostrava última release/não-liberados).
 * Adiciona cadência (releases/mês em 12M) e dias desde a última tag.
 */
import { computed } from 'vue'
import { daysSinceLastRelease, releases, releasesError, releasesPerMonth } from '../releases'

const rows = computed(() =>
  (releases.value?.repos ?? [])
    .map(r => ({
      ...r,
      days: daysSinceLastRelease(r.repo),
      cadence: releasesPerMonth(r.repo),
    }))
    // com tag primeiro (mais recente primeiro), sem tag por último (mais não-liberados primeiro)
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || b.unreleased - a.unreleased)
    .sort((a, b) => Number(b.tags.length > 0) - Number(a.tags.length > 0)),
)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-tag" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-highlighted">Releases por repositório</span>
        <span class="text-xs text-dimmed ml-auto">marcos — ignoram o filtro de período · clique no repo pra ver a cadência completa</span>
      </div>
    </template>

    <!-- skeleton enquanto o releases.json chega; sem dado/erro → instrução -->
    <div v-if="!releases && !releasesError" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <USkeleton v-for="i in 6" :key="i" class="h-20 rounded-lg" />
    </div>
    <p v-else-if="!rows.length || releasesError" class="text-sm text-dimmed">
      Sem dados de release — rode <code>pnpm collect:releases</code> (ou ↻ no navbar).
    </p>

    <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <RouterLink
        v-for="r in rows"
        :key="r.repo"
        :to="{ name: '/repos/[name]', params: { name: r.repo } }"
        class="rounded-lg border border-default px-3 py-2.5 hover:border-primary transition-colors"
      >
        <div class="flex items-center gap-2">
          <span class="font-medium truncate">{{ r.repo }}</span>
          <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto shrink-0">
            {{ r.tags.length }} tags
          </UBadge>
        </div>
        <div class="mt-1.5 text-xs text-dimmed flex items-center gap-1.5 flex-wrap">
          <span class="font-mono">{{ r.tags[0]?.name ?? r.tags[0]?.tag ?? '— sem tags —' }}</span>
          <template v-if="r.days != null">
            <span>·</span>
            <span :class="r.days >= 30 ? 'text-warning' : ''">há {{ r.days }}d</span>
            <span>·</span>
            <span>{{ r.cadence.toFixed(1).replace('.', ',') }}/mês</span>
          </template>
          <UBadge v-if="r.unreleased >= 20" :color="r.unreleased >= 50 ? 'error' : 'warning'" variant="soft" size="xs">
            {{ r.unreleased }} não liberados
          </UBadge>
        </div>
      </RouterLink>
    </div>
  </UCard>
</template>
