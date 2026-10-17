<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  filters,
  isCustomRange,
  resetSelection,
  setAuthors,
  setCustomRange,
  setRange,
  setRepos,
  setShowBots,
  stats,
  toggleAuthor,
  toggleCustomRange,
  toggleRepo,
  toggleTeam,
} from '@/data'
import { loadTeam, team } from '@/team'

const route = useRoute()

// escopo por rota (route.meta.filters): período vale em todas as rotas de
// dados; repos no escopo 'full' e no 'team'; devs/bots só no 'full' — no 'team'
// a página trava os devs nos membros do time (a sidebar não pode editar)
type FilterScope = 'full' | 'team' | 'period' | 'period-bots' | 'none'
const scope = computed<FilterScope>(() => (route.meta.filters as FilterScope | undefined) ?? 'none')
const showRepos = computed(() => scope.value === 'full' || scope.value === 'team')
const showDevs = computed(() => scope.value === 'full')
const showBots = computed(() => scope.value === 'full' || scope.value === 'period-bots')

// times como atalho de filtro: carrega o team.json sob demanda (só no escopo full)
watch(showDevs, (v) => {
  if (v)
    loadTeam()
}, { immediate: true })

const ranges = [
  { label: '1M', months: 1 },
  { label: '3M', months: 3 },
  { label: '6M', months: 6 },
  { label: '12M', months: 12 },
  { label: '24M', months: 24 },
  { label: 'Tudo', months: null },
] as const

/** datas do range custom (inputs) — escrita sempre pelas ações de @/data (issue #39) */
function setDateFrom(v: string | null) {
  setCustomRange(v, filters.dateTo)
}
function setDateTo(v: string | null) {
  setCustomRange(filters.dateFrom, v)
}

const visibleAuthors = computed(() =>
  (stats.value?.authors ?? []).filter(a => filters.showBots || !a.bot),
)

// times com membros presentes nos autores visíveis — clicar no chip do time
// (des)marca todos os membros de uma vez no filtro de devs
const teamFilters = computed(() => {
  const visible = new Set(visibleAuthors.value.map(a => a.name))
  return (team.value?.teams ?? [])
    .map(t => ({ name: t.name, color: t.color, members: t.members.filter(m => visible.has(m)) }))
    .filter(t => t.members.length > 0)
})

/** 'all' = todos os membros selecionados · 'some' = parcial · 'none' = nenhum */
function teamState(members: string[]): 'all' | 'some' | 'none' {
  const sel = members.filter(m => filters.authors.includes(m)).length
  return sel === 0 ? 'none' : sel === members.length ? 'all' : 'some'
}

const hasSelection = computed(() => filters.repos.length > 0 || filters.authors.length > 0)

type ListKey = 'repos' | 'authors'
// escritas sempre pelas ações nomeadas de @/data (issue #39)
const setters: Record<ListKey, (list: string[]) => void> = {
  repos: setRepos,
  authors: setAuthors,
}
function allOf(list: ListKey): string[] {
  return list === 'repos' ? (stats.value?.repos ?? []) : visibleAuthors.value.map(a => a.name)
}
function selectAll(list: ListKey) {
  setters[list](allOf(list))
}
function invert(list: ListKey) {
  setters[list](allOf(list).filter(v => !filters[list].includes(v)))
}
function clearList(list: ListKey) {
  setters[list]([])
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
          :color="!isCustomRange() && filters.rangeMonths === r.months ? 'primary' : 'neutral'"
          :variant="!isCustomRange() && filters.rangeMonths === r.months ? 'soft' : 'outline'"
          :aria-pressed="!isCustomRange() && filters.rangeMonths === r.months"
          @click="setRange(r.months)"
        >
          {{ r.label }}
        </UButton>
        <UButton
          size="xs"
          icon="i-lucide-calendar-range"
          :color="isCustomRange() ? 'primary' : 'neutral'"
          :variant="isCustomRange() ? 'soft' : 'outline'"
          :aria-pressed="isCustomRange()"
          @click="toggleCustomRange"
        >
          Personalizado
        </UButton>
      </div>
      <div v-if="isCustomRange()" class="flex items-end gap-1.5">
        <UFormField label="de" :ui="{ label: 'sr-only' }" class="flex-1">
          <UInput :model-value="filters.dateFrom" type="date" size="xs" class="w-full" @update:model-value="setDateFrom" />
        </UFormField>
        <UIcon name="i-lucide-arrow-right" class="size-3.5 text-dimmed shrink-0 mb-1.5" />
        <UFormField label="até" :ui="{ label: 'sr-only' }" class="flex-1">
          <UInput :model-value="filters.dateTo" type="date" size="xs" class="w-full" @update:model-value="setDateTo" />
        </UFormField>
      </div>
      <USwitch v-if="showBots" :model-value="filters.showBots" label="incluir bots" size="sm" class="mt-1" @update:model-value="setShowBots" />
    </section>

    <!-- repos no escopo 'full' e no 'team'; devs/chips de time só no 'full'
         (no 'team' os devs são travados pela página /teams/:name) -->
    <template v-if="showRepos">
      <template v-if="showDevs && teamFilters.length">
        <USeparator />

        <section class="flex flex-col gap-2">
          <span class="filter-label flex items-center gap-1.5">
            <UIcon name="i-lucide-users-round" class="size-3.5" />
            Times
          </span>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="t in teamFilters"
              :key="t.name"
              size="xs"
              :color="teamState(t.members) === 'none' ? 'neutral' : 'primary'"
              :variant="teamState(t.members) === 'all' ? 'soft' : teamState(t.members) === 'some' ? 'outline' : 'ghost'"
              :aria-pressed="teamState(t.members) !== 'none'"
              @click="toggleTeam(t.members)"
            >
              <span
                class="size-2 rounded-full inline-block"
                :style="{ backgroundColor: t.color ?? 'currentColor' }"
              />
              {{ t.name }}
              <span class="opacity-60">{{ t.members.length }}</span>
            </UButton>
          </div>
        </section>
      </template>

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
              <UButton icon="i-lucide-check-check" color="neutral" variant="ghost" size="xs" aria-label="selecionar todos os repos" @click="selectAll('repos')" />
            </UTooltip>
            <UTooltip text="inverter seleção">
              <UButton icon="i-lucide-arrow-left-right" color="neutral" variant="ghost" size="xs" aria-label="inverter seleção de repos" @click="invert('repos')" />
            </UTooltip>
            <UTooltip text="limpar">
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="limpar seleção de repos" @click="clearList('repos')" />
            </UTooltip>
          </span>
        </span>
        <div class="flex flex-wrap gap-1.5">
          <UButton
            v-for="repo in stats?.repos ?? []"
            :key="repo"
            size="xs"
            :color="filters.repos.includes(repo) ? 'primary' : 'neutral'"
            :variant="filters.repos.includes(repo) ? 'soft' : 'ghost'"
            :aria-pressed="filters.repos.includes(repo)"
            @click="toggleRepo(repo)"
          >
            {{ repo }}
          </UButton>
        </div>
      </section>

      <!-- devs editáveis só no escopo 'full' (no 'team' a página trava os membros) -->
      <template v-if="showDevs">
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
                <UButton icon="i-lucide-check-check" color="neutral" variant="ghost" size="xs" aria-label="selecionar todos os devs" @click="selectAll('authors')" />
              </UTooltip>
              <UTooltip text="inverter seleção">
                <UButton icon="i-lucide-arrow-left-right" color="neutral" variant="ghost" size="xs" aria-label="inverter seleção de devs" @click="invert('authors')" />
              </UTooltip>
              <UTooltip text="limpar">
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="limpar seleção de devs" @click="clearList('authors')" />
              </UTooltip>
            </span>
          </span>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="a in visibleAuthors"
              :key="a.name"
              size="xs"
              :color="filters.authors.includes(a.name) ? 'primary' : 'neutral'"
              :variant="filters.authors.includes(a.name) ? 'soft' : 'ghost'"
              :aria-pressed="filters.authors.includes(a.name)"
              @click="toggleAuthor(a.name)"
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
          @click="resetSelection"
        >
          limpar filtros
        </UButton>
      </template>
    </template>
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
