<script setup lang="ts">
/**
 * Releases por repositório — grade dentro de /repos (a página dedicada virou
 * seção aqui: a tabela de repos já mostrava última release/não-liberados).
 * Adiciona cadência (releases/mês em 12M) e dias desde a última tag.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { repoSelected } from '../filters-core'
import { fmtRatio } from '../format'
import { daysSinceLastRelease, lastTagLabel, releases, releasesError, releasesPerMonth } from '../releases'
import { RELEASE_STALE_DAYS, UNRELEASED_AMBER, UNRELEASED_RED } from '../thresholds'

const { t } = useI18n({ useScope: 'global' })

const rows = computed(() =>
  (releases.value?.repos ?? [])
    // segue a seleção de repos da sidebar como a RepoTable (vazio = todos)
    .filter(r => repoSelected(r.repo))
    .map(r => ({
      ...r,
      days: daysSinceLastRelease(r.repo),
      cadence: releasesPerMonth(r.repo),
    }))
    // com tag primeiro; dentro, os que estão há MAIS tempo sem release na frente
    // (dias desde a última tag desc) — sem tag vão por último, com mais não-liberados na frente
    .sort((a, b) => (b.days ?? -1) - (a.days ?? -1) || b.unreleased - a.unreleased)
    .sort((a, b) => Number(b.tags.length > 0) - Number(a.tags.length > 0)),
)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-tag" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-highlighted">{{ t('ui.releases.title') }}</span>
        <span class="text-xs text-dimmed ml-auto">{{ t('ui.releases.note') }}</span>
      </div>
    </template>

    <!-- skeleton enquanto o releases.json chega; sem dado/erro → instrução -->
    <div v-if="!releases && !releasesError" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <USkeleton v-for="i in 6" :key="i" class="h-20 rounded-lg" />
    </div>
    <p v-else-if="releasesError || !releases?.repos.length" class="text-sm text-dimmed">
      {{ t('ui.releases.errorBefore') }} <code>pnpm collect:releases</code> {{ t('ui.releases.errorOr') }} <UIcon name="i-lucide-refresh-cw" class="size-3.5 align-[-2px]" /> {{ t('ui.releases.errorNavbar') }}
    </p>
    <p v-else-if="!rows.length" class="text-sm text-dimmed">
      {{ t('ui.releases.empty') }}
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
            {{ t('ui.releases.tags', { n: r.tags.length }) }}
          </UBadge>
        </div>
        <div class="mt-1.5 text-xs text-dimmed flex items-center gap-1.5 flex-wrap">
          <!-- mesmo rótulo da tabela de repos (lastTagLabel — campo canônico `tag`) -->
          <span class="font-mono">{{ lastTagLabel(r.repo) ?? t('ui.releases.noTags') }}</span>
          <template v-if="r.days != null">
            <span>·</span>
            <span :class="r.days >= RELEASE_STALE_DAYS ? 'text-warning' : ''">{{ t('ui.agoDays', { n: r.days }) }}</span>
            <span>·</span>
            <span>{{ t('ui.releases.cadence', { v: fmtRatio(r.cadence) }) }}</span>
          </template>
          <UBadge v-if="r.unreleased >= UNRELEASED_AMBER" :color="r.unreleased >= UNRELEASED_RED ? 'error' : 'warning'" variant="soft" size="xs">
            {{ t('ui.releases.unreleased', { n: r.unreleased }) }}
          </UBadge>
        </div>
      </RouterLink>
    </div>
  </UCard>
</template>
