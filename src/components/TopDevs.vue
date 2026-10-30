<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { commitsByAuthor } from '../data'
import { fmtInt } from '../format'
import { ghName, mergedPrs } from '../github'
import { topDevs } from '../overview'

/**
 * Top devs do período (Visão geral) — ranking compacto por commits (stats,
 * já filtrados pela sidebar) com PRs merged do dev como sinal secundário.
 * A tabela completa continua em /devs.
 */
const TOP_N = 5

const { t } = useI18n({ useScope: 'global' })

/** PRs merged no período por dev canônico (login → nome via ghName) */
const prsByDev = computed(() => {
  const m = new Map<string, number>()
  for (const pr of mergedPrs.value) {
    const name = ghName(pr.author)
    m.set(name, (m.get(name) ?? 0) + 1)
  }
  return m
})

const top = computed(() => topDevs(commitsByAuthor.value, prsByDev.value, TOP_N))
const maxCommits = computed(() => top.value.rows[0]?.commits ?? 0)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-users" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-highlighted">{{ t('ui.topDevs.title') }}</span>
        <RouterLink to="/devs" class="ml-auto flex items-center gap-1 text-xs text-dimmed hover:text-primary">
          {{ t('ui.topDevs.link') }}
          <UIcon name="i-lucide-arrow-right" class="size-3" />
        </RouterLink>
      </div>
    </template>

    <div v-if="top.rows.length" class="flex flex-col gap-2">
      <div v-for="row in top.rows" :key="row.author" class="flex items-center gap-2 text-sm">
        <RouterLink :to="`/devs/${encodeURIComponent(row.author)}`" class="w-32 sm:w-40 truncate hover:text-primary">
          {{ row.author }}
        </RouterLink>
        <div class="flex-1 h-2 rounded-full bg-primary/10 overflow-hidden">
          <div class="h-full rounded-full bg-primary" :style="{ width: `${maxCommits ? (row.commits / maxCommits) * 100 : 0}%` }" />
        </div>
        <span class="w-12 text-right tabular-nums">{{ fmtInt(row.commits) }}</span>
        <span v-if="row.prs" class="w-14 text-right text-xs text-dimmed whitespace-nowrap">
          {{ t('ui.topDevs.prs', { n: row.prs }) }}
        </span>
      </div>
      <!-- agregado dos devs fora do top — sem barra (soma não compara com um dev só) -->
      <div v-if="top.rest" class="flex items-center gap-2 text-sm text-dimmed">
        <span class="w-32 sm:w-40 truncate">{{ t('ui.topDevs.more', { n: top.rest.devs }) }}</span>
        <span class="flex-1" />
        <span class="w-12 text-right tabular-nums">{{ fmtInt(top.rest.commits) }}</span>
        <span v-if="top.rest.prs" class="w-14 text-right text-xs whitespace-nowrap">
          {{ t('ui.topDevs.prs', { n: top.rest.prs }) }}
        </span>
      </div>
    </div>
    <div v-else class="py-6 text-center text-sm text-muted">
      {{ t('chart.empty') }}
    </div>
  </UCard>
</template>
