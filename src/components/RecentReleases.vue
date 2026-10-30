<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { daysSince, fmtDaysAgo } from '../format'
import { releases } from '../releases'
import { RELEASE_STALE_DAYS } from '../thresholds'

/**
 * Últimas releases da org (Visão geral) — "o que saiu". Tags são marcos:
 * ignoram repos/devs/período da sidebar (mesma regra de /repos#releases).
 */
const { t } = useI18n({ useScope: 'global' })

const RECENT_COUNT = 5

/** tags mais recentes da org inteira, mais nova primeiro */
const recent = computed(() =>
  (releases.value?.repos ?? [])
    .flatMap(r => r.tags.map(tag => ({ repo: r.repo, tag: tag.tag, date: tag.date })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_COUNT),
)

/** repos sem tag ou com a última tag há RELEASE_STALE_DAYS+ dias */
const silent = computed(() =>
  (releases.value?.repos ?? []).filter((r) => {
    const last = r.tags[0]
    return !last || daysSince(last.date) >= RELEASE_STALE_DAYS
  }).length,
)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-tag" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-highlighted">{{ t('ui.recentReleases.title') }}</span>
        <RouterLink to="/repos#releases" class="ml-auto flex items-center gap-1 text-xs text-dimmed hover:text-primary">
          {{ t('ui.recentReleases.link') }}
          <UIcon name="i-lucide-arrow-right" class="size-3" />
        </RouterLink>
      </div>
    </template>

    <div v-if="recent.length" class="flex flex-col gap-1">
      <div v-for="r in recent" :key="`${r.repo}-${r.tag}`" class="flex items-center gap-2 text-sm">
        <RouterLink :to="`/repos/${encodeURIComponent(r.repo)}`" class="text-muted hover:text-primary truncate">
          {{ r.repo }}
        </RouterLink>
        <span class="font-mono text-xs">{{ r.tag }}</span>
        <span class="ml-auto text-xs text-dimmed whitespace-nowrap">{{ fmtDaysAgo(r.date) }}</span>
      </div>
    </div>
    <div v-else class="py-6 text-center text-sm text-muted">
      {{ t('ui.recentReleases.empty') }}
    </div>

    <RouterLink
      v-if="silent"
      to="/repos#releases"
      class="mt-3 flex items-center gap-1.5 text-xs text-dimmed hover:text-primary"
    >
      <UIcon name="i-lucide-alert-triangle" class="size-3.5 text-warning" />
      {{ silent === 1 ? t('ui.recentReleases.silentOne', { days: RELEASE_STALE_DAYS }) : t('ui.recentReleases.silentMany', { n: silent, days: RELEASE_STALE_DAYS }) }}
    </RouterLink>
  </UCard>
</template>
