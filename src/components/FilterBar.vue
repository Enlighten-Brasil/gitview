<script setup lang="ts">
import type { WorkScope } from '@/data'
import type { QuickRange } from '@/date'
import type { FilterScope } from '@/router/meta'
import { parseDate } from '@internationalized/date'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import {
  filters,
  isCustomRange,
  rangeLabel,
  resetSelection,
  setAuthors,
  setCustomRange,
  setRange,
  setRepos,
  setShowBots,
  setWorkScope,
  stats,
  toggleAuthor,
  toggleRepo,
  toggleTeam,
} from '@/data'
import { QUICK_RANGES, quickRange } from '@/date'
import { loadTeam, team } from '@/team'

const route = useRoute()
const { t, locale } = useI18n({ useScope: 'global' })

// escopo por rota (route.meta.filters): período vale em todas as rotas de
// dados; repos no escopo 'full' e no 'team'; devs/bots só no 'full' — no 'team'
// a página trava os devs nos membros do time (a sidebar não pode editar)
const scope = computed<FilterScope>(() => route.meta.filters ?? 'none')
const showRepos = computed(() => scope.value === 'full' || scope.value === 'team')
const showDevs = computed(() => scope.value === 'full')
const showBots = computed(() => scope.value === 'full' || scope.value === 'period-bots')

// chips de Escopo (issue #129): valem em toda rota de dados, como o período —
// com duas condições: feature-detect de dados pós-#119 (totals.prodCommits;
// sem o split não há o que recortar, mesma guarda do sanitize do urlState) e a
// exclusão de /branches (a página É a vista do progresso e não consome
// filters.workScope — registro da #124). Fora do resetSelection: escopo é
// contexto, como o período.
const showWorkScope = computed(() =>
  !!stats.value && 'prodCommits' in stats.value.totals && route.meta.section !== 'branches',
)

// seção Período (issue #210): oculta em /branches com a mesma guarda dos chips
// de Escopo acima — a página é inventário "agora" e não consome o período
// (o switch "incluir bots" fica: branches.ts consome filters.showBots)
const showPeriod = computed(() => route.meta.section !== 'branches')

// valor = dado de negócio; o rótulo vem do catálogo (chave estática por value —
// uso dinâmico: o gate no-unused-keys não segue t(chave variável))
const workScopeKeys: Record<WorkScope, string> = {
  all: 'filters.scope.all',
  prod: 'filters.scope.prod',
  progress: 'filters.scope.progress',
}
const workScopes: readonly WorkScope[] = ['all', 'prod', 'progress']

// times como atalho de filtro: carrega o team.json sob demanda (só no escopo full)
watch(showDevs, (v) => {
  if (v)
    loadTeam()
}, { immediate: true })

// meses = dado; o rótulo do chip vem do catálogo (mesma chave estática por
// value dos workScopes — null = janela completa)
const rangeKeys = new Map<number, string>([
  [1, 'filters.chip.1m'],
  [3, 'filters.chip.3m'],
  [6, 'filters.chip.6m'],
  [12, 'filters.chip.12m'],
  [24, 'filters.chip.24m'],
])
const ranges: readonly (number | null)[] = [1, 3, 6, 12, 24, null]

function chipLabel(months: number | null): string {
  if (months == null)
    return t('filters.chip.all')
  const key = rangeKeys.get(months)
  if (key === undefined)
    throw new Error(`[filters] range sem chave de chip: ${months} meses`)
  return t(key)
}

/**
 * Atalhos de período curto — materializados como range custom (from/to) para
 * reaproveitar URL/cutoff/predicados. `quickActive` é derivado (compara as
 * datas com a janela do atalho HOJE), então não dessincroniza com a URL.
 */
const quickKeys: Record<QuickRange, string> = {
  d7: 'filters.chip.7d',
  thisWeek: 'filters.chip.thisWeek',
  lastWeek: 'filters.chip.lastWeek',
}

function applyQuick(kind: QuickRange) {
  const r = quickRange(kind)
  setCustomRange(r.from, r.to)
}

const quickActive = computed<QuickRange | null>(() => {
  if (!isCustomRange())
    return null
  for (const k of QUICK_RANGES) {
    const r = quickRange(k)
    if (filters.dateFrom === r.from && filters.dateTo === r.to)
      return k
  }
  return null
})

// calendário do range custom (UPopover + UCalendar): draft local — só range
// completo (start+end) aplica; reabrir ressincroniza com as datas atuais
interface CalRange { start?: { toString: () => string }, end?: { toString: () => string } }
const customOpen = ref(false)
const calDraft = ref<CalRange | null>(null)
const calPlaceholder = computed(() => filters.dateFrom ? parseDate(filters.dateFrom) : undefined)

watch(customOpen, (open) => {
  if (open) {
    calDraft.value = {
      start: filters.dateFrom ? parseDate(filters.dateFrom) : undefined,
      end: filters.dateTo ? parseDate(filters.dateTo) : undefined,
    }
  }
})

function onCalRange(v: CalRange | null) {
  calDraft.value = v
  const from = v?.start?.toString()
  const to = v?.end?.toString()
  if (from && to) {
    setCustomRange(from, to)
    customOpen.value = false
  }
}

function clearCustom() {
  setCustomRange(null, null)
  calDraft.value = null
  customOpen.value = false
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
    <section v-if="showPeriod || showBots" class="flex flex-col gap-2">
      <template v-if="showPeriod">
        <span class="filter-label">{{ t('filters.period') }}</span>
        <div class="flex flex-wrap gap-1.5">
          <UButton
            v-for="k in QUICK_RANGES"
            :key="k"
            size="xs"
            :color="quickActive === k ? 'primary' : 'neutral'"
            :variant="quickActive === k ? 'soft' : 'outline'"
            :aria-pressed="quickActive === k"
            @click="applyQuick(k)"
          >
            {{ t(quickKeys[k]) }}
          </UButton>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <UButton
            v-for="r in ranges"
            :key="String(r)"
            size="xs"
            :color="!isCustomRange() && filters.rangeMonths === r ? 'primary' : 'neutral'"
            :variant="!isCustomRange() && filters.rangeMonths === r ? 'soft' : 'outline'"
            :aria-pressed="!isCustomRange() && filters.rangeMonths === r"
            @click="setRange(r)"
          >
            {{ chipLabel(r) }}
          </UButton>
          <UPopover v-model:open="customOpen" :ui="{ content: 'w-auto p-3' }">
            <UButton
              size="xs"
              icon="i-lucide-calendar-range"
              :color="isCustomRange() && !quickActive ? 'primary' : 'neutral'"
              :variant="isCustomRange() && !quickActive ? 'soft' : 'outline'"
              :aria-pressed="isCustomRange()"
            >
              {{ t('filters.custom') }}
            </UButton>
            <template #content>
              <div class="flex flex-col gap-2">
                <UCalendar
                  :model-value="calDraft"
                  range
                  :week-starts-on="1"
                  :locale="locale"
                  :placeholder="calPlaceholder"
                  @update:model-value="onCalRange"
                />
                <div class="flex items-center gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    :label="t('filters.range.clear')"
                    @click="clearCustom"
                  />
                  <span class="ml-auto text-xs text-dimmed">{{ rangeLabel }}</span>
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </template>
      <USwitch v-if="showBots" :model-value="filters.showBots" :label="t('filters.bots')" size="sm" class="mt-1" @update:model-value="setShowBots" />
    </section>

    <!-- chips de escopo de trabalho (issue #129) — ver showWorkScope no script:
         feature-detect + exclusão de /branches; fora do "limpar filtros" -->
    <template v-if="showWorkScope">
      <USeparator />

      <section class="flex flex-col gap-2">
        <span class="filter-label flex items-center gap-1.5">
          <UIcon name="i-lucide-layers" class="size-3.5" />
          {{ t('filters.scopes.title') }}
          <UTooltip :ui="{ content: 'max-w-64' }" :text="t('filters.scopes.help')">
            <UIcon name="i-lucide-info" class="size-3 text-dimmed cursor-help" />
          </UTooltip>
        </span>
        <div class="flex flex-wrap gap-1.5">
          <UButton
            v-for="s in workScopes"
            :key="s"
            size="xs"
            :color="filters.workScope === s ? 'primary' : 'neutral'"
            :variant="filters.workScope === s ? 'soft' : 'outline'"
            :aria-pressed="filters.workScope === s"
            @click="setWorkScope(s)"
          >
            {{ t(workScopeKeys[s]) }}
          </UButton>
        </div>
      </section>
    </template>

    <!-- repos no escopo 'full' e no 'team'; devs/chips de time só no 'full'
         (no 'team' os devs são travados pela página /teams/:name) -->
    <template v-if="showRepos">
      <template v-if="showDevs && teamFilters.length">
        <USeparator />

        <section class="flex flex-col gap-2">
          <span class="filter-label flex items-center gap-1.5">
            <UIcon name="i-lucide-users-round" class="size-3.5" />
            {{ t('filters.times') }}
          </span>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              v-for="tf in teamFilters"
              :key="tf.name"
              size="xs"
              :color="teamState(tf.members) === 'none' ? 'neutral' : 'primary'"
              :variant="teamState(tf.members) === 'all' ? 'soft' : teamState(tf.members) === 'some' ? 'outline' : 'ghost'"
              :aria-pressed="teamState(tf.members) !== 'none'"
              @click="toggleTeam(tf.members)"
            >
              <span
                class="size-2 rounded-full inline-block"
                :style="{ backgroundColor: tf.color ?? 'currentColor' }"
              />
              {{ tf.name }}
              <span class="opacity-60">{{ tf.members.length }}</span>
            </UButton>
          </div>
        </section>
      </template>

      <USeparator />

      <section class="flex flex-col gap-2">
        <span class="filter-label flex items-center gap-1.5">
          <UIcon name="i-lucide-git-branch" class="size-3.5" />
          {{ t('filters.repos') }}
          <UBadge v-if="filters.repos.length" color="primary" variant="soft" size="sm">
            {{ filters.repos.length }}
          </UBadge>
          <span class="ml-auto flex items-center">
            <UTooltip :text="t('filters.selectAll')">
              <UButton icon="i-lucide-check-check" color="neutral" variant="ghost" size="xs" :aria-label="t('filters.aria.selectAll', { target: 'repos' })" @click="selectAll('repos')" />
            </UTooltip>
            <UTooltip :text="t('filters.invert')">
              <UButton icon="i-lucide-arrow-left-right" color="neutral" variant="ghost" size="xs" :aria-label="t('filters.aria.invert', { target: 'repos' })" @click="invert('repos')" />
            </UTooltip>
            <UTooltip :text="t('filters.clear')">
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('filters.aria.clear', { target: 'repos' })" @click="clearList('repos')" />
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
            {{ t('filters.devs') }}
            <UBadge v-if="filters.authors.length" color="primary" variant="soft" size="sm">
              {{ filters.authors.length }}
            </UBadge>
            <span class="ml-auto flex items-center">
              <UTooltip :text="t('filters.selectAll')">
                <UButton icon="i-lucide-check-check" color="neutral" variant="ghost" size="xs" :aria-label="t('filters.aria.selectAll', { target: 'devs' })" @click="selectAll('authors')" />
              </UTooltip>
              <UTooltip :text="t('filters.invert')">
                <UButton icon="i-lucide-arrow-left-right" color="neutral" variant="ghost" size="xs" :aria-label="t('filters.aria.invert', { target: 'devs' })" @click="invert('authors')" />
              </UTooltip>
              <UTooltip :text="t('filters.clear')">
                <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="t('filters.aria.clear', { target: 'devs' })" @click="clearList('authors')" />
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
          {{ t('filters.clearFilters') }}
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
