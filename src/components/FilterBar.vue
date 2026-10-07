<script setup lang="ts">
import { computed } from 'vue'
import { filters, stats } from '../data'

const ranges = [
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
  { label: 'Tudo', months: null },
] as const

const visibleAuthors = computed(() =>
  (stats.value?.authors ?? []).filter(a => filters.showBots || !a.bot),
)

const hasSelection = computed(() => filters.repos.length > 0 || filters.authors.length > 0)

function toggle(list: string[], value: string) {
  const i = list.indexOf(value)
  if (i >= 0) list.splice(i, 1)
  else list.push(value)
}

function clearSelection() {
  filters.repos = []
  filters.authors = []
}
</script>

<template>
  <div class="sticky top-3 z-20 mb-4 rounded-xl border border-default bg-elevated/90 backdrop-blur-md shadow-xl p-4 flex flex-col gap-3">
    <div class="flex items-center gap-2 flex-wrap">
      <span class="w-14 text-[11px] font-bold uppercase tracking-wider text-muted">Período</span>
      <UButton
        v-for="r in ranges"
        :key="r.label"
        size="xs"
        :color="filters.rangeMonths === r.months ? 'primary' : 'neutral'"
        :variant="filters.rangeMonths === r.months ? 'solid' : 'outline'"
        @click="filters.rangeMonths = r.months"
      >
        {{ r.label }}
      </UButton>

      <USwitch v-model="filters.showBots" label="incluir bots" size="sm" class="ml-2" />

      <UButton
        v-if="hasSelection"
        size="xs"
        color="error"
        variant="ghost"
        icon="i-lucide-x"
        class="ml-auto"
        @click="clearSelection"
      >
        limpar filtros
      </UButton>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <span class="w-14 text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
        <UIcon name="i-lucide-git-branch" class="size-3.5" /> Repos
      </span>
      <UButton
        v-for="repo in stats?.repos ?? []"
        :key="repo"
        size="xs"
        :color="filters.repos.includes(repo) ? 'primary' : 'neutral'"
        :variant="filters.repos.includes(repo) ? 'solid' : 'ghost'"
        @click="toggle(filters.repos, repo)"
      >
        {{ repo }}
      </UButton>
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <span class="w-14 text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
        <UIcon name="i-lucide-users" class="size-3.5" /> Devs
      </span>
      <UButton
        v-for="a in visibleAuthors"
        :key="a.name"
        size="xs"
        :color="filters.authors.includes(a.name) ? 'primary' : 'neutral'"
        :variant="filters.authors.includes(a.name) ? 'solid' : 'ghost'"
        @click="toggle(filters.authors, a.name)"
      >
        {{ a.name }}
      </UButton>
    </div>
  </div>
</template>
