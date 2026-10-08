<script setup lang="ts">
import { computed } from 'vue'
import { filters, stats } from '../data'

const ranges = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
  { label: '24M', months: 24 },
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

type ListKey = 'repos' | 'authors'
function allOf(list: ListKey): string[] {
  return list === 'repos' ? (stats.value?.repos ?? []) : visibleAuthors.value.map(a => a.name)
}
function selectAll(list: ListKey) {
  filters[list] = allOf(list)
}
function invert(list: ListKey) {
  filters[list] = allOf(list).filter(v => !filters[list].includes(v))
}
function clearList(list: ListKey) {
  filters[list] = []
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <section class="flex flex-col gap-2">
      <span class="filter-label">Período</span>
      <div class="flex flex-wrap gap-1.5">
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
      </div>
      <USwitch v-model="filters.showBots" label="incluir bots" size="sm" class="mt-1" />
    </section>

    <USeparator />

    <section class="flex flex-col gap-2">
      <span class="filter-label flex items-center gap-1.5">
        <UIcon name="i-lucide-git-branch" class="size-3.5" />
        Repos
        <UBadge v-if="filters.repos.length" color="primary" variant="soft" size="sm">
          {{ filters.repos.length }}
        </UBadge>
        <span class="ml-auto flex items-center">
          <UTooltip text="selecionar todos">
            <UButton icon="i-lucide-check-check" color="neutral" variant="ghost" size="xs" @click="selectAll('repos')" />
          </UTooltip>
          <UTooltip text="inverter seleção">
            <UButton icon="i-lucide-arrow-left-right" color="neutral" variant="ghost" size="xs" @click="invert('repos')" />
          </UTooltip>
          <UTooltip text="limpar">
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" @click="clearList('repos')" />
          </UTooltip>
        </span>
      </span>
      <div class="flex flex-wrap gap-1.5">
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
    </section>

    <USeparator />

    <section class="flex flex-col gap-2">
      <span class="filter-label flex items-center gap-1.5">
        <UIcon name="i-lucide-users" class="size-3.5" />
        Devs
        <UBadge v-if="filters.authors.length" color="primary" variant="soft" size="sm">
          {{ filters.authors.length }}
        </UBadge>
        <span class="ml-auto flex items-center">
          <UTooltip text="selecionar todos">
            <UButton icon="i-lucide-check-check" color="neutral" variant="ghost" size="xs" @click="selectAll('authors')" />
          </UTooltip>
          <UTooltip text="inverter seleção">
            <UButton icon="i-lucide-arrow-left-right" color="neutral" variant="ghost" size="xs" @click="invert('authors')" />
          </UTooltip>
          <UTooltip text="limpar">
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" @click="clearList('authors')" />
          </UTooltip>
        </span>
      </span>
      <div class="flex flex-wrap gap-1.5">
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
    </section>

    <UButton
      v-if="hasSelection"
      size="xs"
      color="error"
      variant="ghost"
      icon="i-lucide-x"
      block
      @click="clearSelection"
    >
      limpar filtros
    </UButton>
  </div>
</template>

<style scoped>
.filter-label {
  display: flex;
  align-items: center;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ui-text-muted);
}
</style>
