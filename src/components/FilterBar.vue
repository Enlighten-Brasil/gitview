<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { filters, isCustomRange, stats } from '@/data'
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

/** preset de período: limpa o range customizado */
function setRange(months: number | null) {
  filters.dateFrom = null
  filters.dateTo = null
  filters.rangeMonths = months
}

/** ativa o modo personalizado pré-preenchendo com a janela atual; desativa limpando as datas */
function toggleCustom() {
  if (isCustomRange()) {
    filters.dateFrom = null
    filters.dateTo = null
    return
  }
  const from = new Date()
  if (filters.rangeMonths != null)
    from.setMonth(from.getMonth() - filters.rangeMonths)
  else
    from.setFullYear(from.getFullYear() - 10)
  filters.dateFrom = from.toISOString().slice(0, 10)
  filters.dateTo = new Date().toISOString().slice(0, 10)
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

function toggleTeam(members: string[]) {
  if (teamState(members) === 'all') {
    filters.authors = filters.authors.filter(a => !members.includes(a))
  }
  else {
    filters.authors = [...new Set([...filters.authors, ...members])]
  }
}

const hasSelection = computed(() => filters.repos.length > 0 || filters.authors.length > 0)

function toggle(list: string[], value: string) {
  const i = list.indexOf(value)
  if (i >= 0)
    list.splice(i, 1)
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
          :color="!isCustomRange() && filters.rangeMonths === r.months ? 'primary' : 'neutral'"
          :variant="!isCustomRange() && filters.rangeMonths === r.months ? 'solid' : 'outline'"
          @click="setRange(r.months)"
        >
          {{ r.label }}
        </UButton>
        <UButton
          size="xs"
          icon="i-lucide-calendar-range"
          :color="isCustomRange() ? 'primary' : 'neutral'"
          :variant="isCustomRange() ? 'solid' : 'outline'"
          @click="toggleCustom"
        >
          Personalizado
        </UButton>
      </div>
      <div v-if="isCustomRange()" class="flex items-center gap-1.5">
        <UInput v-model="filters.dateFrom" type="date" size="xs" class="flex-1" />
        <span class="text-dimmed text-xs">→</span>
        <UInput v-model="filters.dateTo" type="date" size="xs" class="flex-1" />
      </div>
      <USwitch v-if="showBots" v-model="filters.showBots" label="incluir bots" size="sm" class="mt-1" />
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
              :color="teamState(t.members) === 'all' ? 'primary' : teamState(t.members) === 'some' ? 'primary' : 'neutral'"
              :variant="teamState(t.members) === 'all' ? 'solid' : teamState(t.members) === 'some' ? 'soft' : 'ghost'"
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
