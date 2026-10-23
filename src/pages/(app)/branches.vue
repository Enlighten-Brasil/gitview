<script setup lang="ts">
/**
 * Branches — a vista do progresso (issue #124): inventário do branches.json
 * (coleta #123) + join branch↔PR com o github.json (vínculo #122) e os status
 * derivados no frontend ('viva-sem-PR', 'pousada-via-squash').
 *
 * Filtros: escopo 'full' (repos/devs/bots na sidebar E na URL); o período NÃO
 * se aplica — o inventário é "agora", como os PRs abertos. A página NÃO
 * consome filters.workScope: /branches é por natureza a vista do progresso
 * (o filtro de escopo, issue #129, exclui os chips quando
 * route.meta.section === 'branches').
 */
import type { BranchRowView } from '@/branches'
import type { BranchStatus } from '@/types'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  abandonadas,
  abandonadasTop,
  BRANCH_STALE_DAYS,
  branches,
  branchesAge,
  branchesError,
  branchRows,
  integrationSkew,
  loadBranches,
  pousadas,
  pousadasTop,
  prLinkCoverage,
} from '@/branches'
import TablePanel from '@/components/TablePanel.vue'
import { fmtDate, fmtDateTime, fmtDaysAgo, fmtInt } from '@/format'
import { githubError } from '@/github'
import { loadTeam } from '@/team'

definePage({
  meta: {
    section: 'branches',
    filters: 'full',
    title: 'nav.sections.branches',
  },
})

onMounted(loadBranches)
// mapeamento e-mail→dev dos autores à frente (o loader tem cache — sem 2º fetch)
onMounted(loadTeam)

const router = useRouter()
const { t } = useI18n({ useScope: 'global' })
// Espaçamento explícito em `${t(...)}` em nós de borda: o compilador do Vue remove
// o nó de whitespace puro que é primeiro/último filho, então o ' X ' que o copy
// original renderizava só se mantém vindo da própria interpolação (probe de texto
// byte-idêntico antes/depois).

const repoCount = computed(() => new Set(branchRows.value.map(r => r.repo)).size)

// ---------------------------------------------------------------------------
// cards → tabela (deep-link interno: filtro rápido + scroll pra âncora)
// ---------------------------------------------------------------------------
type QuickFilter = 'pousadas' | 'abandonadas' | null
const quickFilter = ref<QuickFilter>(null)

function focusTable(filter: QuickFilter) {
  quickFilter.value = filter
  router.push({ path: '/branches', hash: '#tabela' })
}

/** rótulo do chip de filtro rápido — o valor do filtro é chave de catálogo */
const quickChip = computed(() => {
  if (!quickFilter.value)
    return ''
  return t('branches.table.onlyChip', {
    name: quickFilter.value === 'pousadas' ? t('branches.filter.pousadas') : t('branches.filter.abandonadas'),
  })
})

// ---------------------------------------------------------------------------
// ordenação da tabela (padrão DevTable: sortKey/sortAsc + aria-sort)
// ---------------------------------------------------------------------------
type Key = 'name' | 'repo' | 'status' | 'aheadProd' | 'behindProd' | 'aheadInt' | 'ageDays' | 'authors' | 'pr'
const sortKey = ref<Key>('ageDays')
const sortAsc = ref(false)

function toggleSort(key: Key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  }
  else {
    sortKey.value = key
    sortAsc.value = false
  }
}

/** aria-sort do th: só a coluna ativa anuncia a direção; as demais ficam 'none' */
function ariaSort(key: Key): 'ascending' | 'descending' | 'none' {
  if (sortKey.value !== key)
    return 'none'
  return sortAsc.value ? 'ascending' : 'descending'
}

function sortValue(r: BranchRowView, key: Key): number | string {
  switch (key) {
    case 'name': return r.name.toLowerCase()
    case 'repo': return r.repo.toLowerCase()
    case 'status': return r.status
    case 'aheadProd': return r.aheadProd
    case 'behindProd': return r.behindProd
    case 'aheadInt': return r.aheadInt ?? Number.MIN_SAFE_INTEGER
    case 'ageDays': return r.ageDays
    case 'authors': return r.authorNames.length
    case 'pr': return r.pr?.number ?? -1
  }
}

const rows = computed(() => {
  const base = quickFilter.value === 'pousadas'
    ? pousadas.value
    : quickFilter.value === 'abandonadas'
      ? abandonadas.value
      : branchRows.value
  return [...base].sort((a, b) => {
    const av = sortValue(a, sortKey.value)
    const bv = sortValue(b, sortKey.value)
    const cmp = typeof av === 'number' && typeof bv === 'number'
      ? av - bv
      : String(av).localeCompare(String(bv))
    // desempate estável: repo + nome da branch
    return sortAsc.value ? cmp || a.repo.localeCompare(b.repo) || a.name.localeCompare(b.name) : -cmp
  })
})

// ---------------------------------------------------------------------------
// badges de status (union do coletor + derivados do join)
// ---------------------------------------------------------------------------
function statusBadge(status: BranchStatus): { label: string, color: 'neutral' | 'info' | 'primary' | 'success', variant: 'outline' | 'soft' | 'subtle' } {
  switch (status) {
    case 'production': return { label: t('branches.status.production'), color: 'neutral', variant: 'outline' }
    case 'integration': return { label: t('branches.status.integration'), color: 'info', variant: 'subtle' }
    case 'feature': return { label: t('branches.status.feature'), color: 'primary', variant: 'subtle' }
    case 'bot': return { label: t('branches.status.bot'), color: 'neutral', variant: 'soft' }
    case 'pousada': return { label: t('branches.status.pousada'), color: 'success', variant: 'subtle' }
  }
}

/** cor da idade: sem atividade há ≥ BRANCH_STALE_DAYS destaca (mesma janela dos cards) */
function ageClass(days: number): string {
  return days >= BRANCH_STALE_DAYS ? 'text-warning' : 'text-muted'
}
</script>

<template>
  <div class="max-w-[1320px] w-full mx-auto px-5 py-6">
    <UAlert
      v-if="branchesError"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('branches.error.noBranches')"
      :description="t('branches.error.noBranchesDesc', { msg: branchesError })"
    />
    <div v-else-if="branches" class="flex flex-col gap-4">
      <!-- frescor do inventário + cobertura do vínculo PR↔branch -->
      <div class="flex flex-wrap items-center gap-3 text-xs">
        <UTooltip v-if="branchesAge" :text="t('branches.freshness.tooltip', { date: fmtDateTime(branchesAge.generatedAt) })">
          <span
            class="inline-flex items-center gap-1"
            :class="branchesAge.stale ? 'text-warning' : 'text-dimmed'"
          >
            <UIcon :name="branchesAge.stale ? 'i-lucide-triangle-alert' : 'i-lucide-clock'" class="size-3.5" />
            {{ t('branches.freshness.badge', { age: branchesAge.label }) }}
          </span>
        </UTooltip>
        <span class="inline-flex items-center gap-1 text-dimmed">
          <UIcon name="i-lucide-list-tree" class="size-3.5" />
          {{ `${t('branches.summary', { n: branchRows.length, r: repoCount })} ` }}
        </span>
        <UTooltip
          v-if="prLinkCoverage && prLinkCoverage.pct < 100"
          :text="t('branches.coverage.tooltip', { covered: prLinkCoverage.withHead, total: prLinkCoverage.total })"
        >
          <UBadge color="warning" variant="subtle" size="sm" icon="i-lucide-circle-alert">
            {{ ` ${t('branches.coverage.badge', { pct: prLinkCoverage.pct })} ` }}
          </UBadge>
        </UTooltip>
      </div>

      <UAlert
        v-if="githubError"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="t('branches.error.noGithub')"
        :description="t('branches.error.noGithubDesc', { msg: githubError })"
      />

      <!-- cards de populações disjuntas + desvio develop×prod por repo -->
      <div class="grid gap-3 lg:grid-cols-3 items-start">
        <section id="pousadas" class="scroll-mt-16">
          <UCard :ui="{ body: 'p-4 flex flex-col gap-2' }">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-plane-landing" class="size-4 shrink-0 text-success" />
              <span class="text-sm font-semibold text-highlighted">{{ t('branches.card.pousadas.title') }}</span>
              <UBadge color="success" variant="subtle" size="sm" class="ml-auto shrink-0">
                {{ pousadas.length }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              {{ ` ${t('branches.card.pousadas.desc', { n: BRANCH_STALE_DAYS })} ` }}
            </p>
            <ul v-if="pousadas.length" class="flex flex-col gap-1 text-xs">
              <li v-for="b in pousadasTop" :key="`${b.repo}/${b.name}`" class="flex items-center gap-1.5 min-w-0">
                <RouterLink :to="{ name: '/repos/[name]', params: { name: b.repo } }" class="text-muted hover:text-primary shrink-0">
                  {{ b.repo }}
                </RouterLink>
                <span class="text-dimmed shrink-0">{{ t('branches.sep.dot') }}</span>
                <a v-if="b.githubUrl" :href="b.githubUrl" target="_blank" rel="noopener" class="text-primary hover:underline truncate">
                  {{ b.name }}
                </a>
                <span v-else class="truncate">{{ b.name }}</span>
                <UTooltip v-if="b.squashPousada" :text="t('branches.tooltip.squashReleased')">
                  <UBadge color="info" variant="soft" size="sm" class="shrink-0">
                    {{ ` ${t('branches.badge.squash')} ` }}
                  </UBadge>
                </UTooltip>
              </li>
            </ul>
            <p v-else class="text-xs text-dimmed">
              {{ ` ${t('branches.card.pousadas.empty')} ` }}
            </p>
            <UButton
              v-if="pousadas.length"
              size="xs"
              color="neutral"
              variant="link"
              :label="t('branches.card.seeAll')"
              trailing-icon="i-lucide-arrow-down"
              class="self-start px-0"
              @click="focusTable('pousadas')"
            />
          </UCard>
        </section>

        <section id="abandonadas" class="scroll-mt-16">
          <UCard :ui="{ body: 'p-4 flex flex-col gap-2' }">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-life-buoy" class="size-4 shrink-0 text-warning" />
              <span class="text-sm font-semibold text-highlighted">{{ t('branches.card.abandonadas.title') }}</span>
              <UBadge color="warning" variant="subtle" size="sm" class="ml-auto shrink-0">
                {{ abandonadas.length }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              {{ ` ${t('branches.card.abandonadas.desc', { n: BRANCH_STALE_DAYS })} ` }}
            </p>
            <ul v-if="abandonadas.length" class="flex flex-col gap-1 text-xs">
              <li v-for="b in abandonadasTop" :key="`${b.repo}/${b.name}`" class="flex items-center gap-1.5 min-w-0">
                <RouterLink :to="{ name: '/repos/[name]', params: { name: b.repo } }" class="text-muted hover:text-primary shrink-0">
                  {{ b.repo }}
                </RouterLink>
                <span class="text-dimmed shrink-0">{{ t('branches.sep.dot') }}</span>
                <a v-if="b.githubUrl" :href="b.githubUrl" target="_blank" rel="noopener" class="text-primary hover:underline truncate">
                  {{ b.name }}
                </a>
                <span v-else class="truncate">{{ b.name }}</span>
                <span class="ml-auto text-dimmed shrink-0">{{ t('branches.card.abandonadas.meta', { ahead: fmtInt(b.aheadProd), days: b.ageDays }) }}</span>
              </li>
            </ul>
            <p v-else class="text-xs text-dimmed">
              {{ ` ${t('branches.card.abandonadas.empty')} ` }}
            </p>
            <UButton
              v-if="abandonadas.length"
              size="xs"
              color="neutral"
              variant="link"
              :label="t('branches.card.seeAll')"
              trailing-icon="i-lucide-arrow-down"
              class="self-start px-0"
              @click="focusTable('abandonadas')"
            />
          </UCard>
        </section>

        <section id="develop-producao" class="scroll-mt-16">
          <UCard :ui="{ body: 'p-4 flex flex-col gap-2' }">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-git-compare-arrows" class="size-4 shrink-0 text-primary" />
              <span class="text-sm font-semibold text-highlighted">{{ t('branches.card.skew.title') }}</span>
              <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto shrink-0">
                {{ integrationSkew.length }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              {{ ` ${t('branches.card.skew.desc')} ` }}
            </p>
            <ul v-if="integrationSkew.length" class="flex flex-col gap-1 text-xs max-h-40 overflow-auto">
              <li v-for="s in integrationSkew" :key="s.repo" class="flex items-center gap-1.5 min-w-0">
                <RouterLink :to="{ name: '/repos/[name]', params: { name: s.repo } }" class="text-primary hover:underline truncate">
                  {{ s.repo }}
                </RouterLink>
                <UTooltip v-if="s.stale" :text="t('branches.card.skew.stale', { n: BRANCH_STALE_DAYS })">
                  <UIcon name="i-lucide-hourglass" class="size-3 shrink-0 text-dimmed" />
                </UTooltip>
                <span class="ml-auto flex items-center gap-2 whitespace-nowrap shrink-0">
                  <UTooltip :text="t('branches.card.skew.ahead', { n: fmtInt(s.ahead) })">
                    <span :class="s.ahead > 0 ? 'text-warning font-medium' : 'text-dimmed'">{{ t('branches.value.plus', { n: fmtInt(s.ahead) }) }}</span>
                  </UTooltip>
                  <UTooltip :text="s.ahead === 0 && s.behind > 0 ? t('branches.card.skew.behindDead', { n: fmtInt(s.behind) }) : t('branches.card.skew.behind', { n: fmtInt(s.behind) })">
                    <span :class="s.ahead === 0 && s.behind > 0 ? 'text-error font-medium' : 'text-dimmed'">{{ t('branches.value.minus', { n: fmtInt(s.behind) }) }}</span>
                  </UTooltip>
                </span>
              </li>
            </ul>
            <p v-else class="text-xs text-dimmed">
              {{ ` ${t('branches.card.skew.empty')} ` }}
            </p>
          </UCard>
        </section>
      </div>

      <!-- tabela ordenável -->
      <section id="tabela" class="scroll-mt-16">
        <TablePanel :title="t('branches.table.title')" icon="i-lucide-git-branch" :count="rows.length">
          <template #actions>
            <UButton
              v-if="quickFilter"
              size="xs"
              color="neutral"
              variant="subtle"
              :label="quickChip"
              trailing-icon="i-lucide-x"
              @click="quickFilter = null"
            />
          </template>
          <div class="overflow-x-auto">
            <table class="data-table">
              <thead>
                <tr>
                  <th class="sortable" :aria-sort="ariaSort('name')">
                    <button type="button" class="th-sort" @click="toggleSort('name')">
                      {{ ` ${t('branches.th.branch')}` }}
                      <UIcon v-if="sortKey === 'name'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="sortable" :aria-sort="ariaSort('repo')">
                    <button type="button" class="th-sort" @click="toggleSort('repo')">
                      {{ ` ${t('branches.th.repo')}` }}
                      <UIcon v-if="sortKey === 'repo'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="sortable" :aria-sort="ariaSort('status')">
                    <button type="button" class="th-sort" @click="toggleSort('status')">
                      {{ ` ${t('branches.th.status')}` }}
                      <UIcon v-if="sortKey === 'status'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="num sortable" :aria-sort="ariaSort('aheadProd')">
                    <button type="button" class="th-sort" @click="toggleSort('aheadProd')">
                      {{ ` ${t('branches.th.ahead')}` }}
                      <UIcon v-if="sortKey === 'aheadProd'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="num sortable" :aria-sort="ariaSort('behindProd')">
                    <button type="button" class="th-sort" @click="toggleSort('behindProd')">
                      {{ ` ${t('branches.th.behind')}` }}
                      <UIcon v-if="sortKey === 'behindProd'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="num sortable" :aria-sort="ariaSort('aheadInt')">
                    <button type="button" class="th-sort" @click="toggleSort('aheadInt')">
                      {{ ` ${t('branches.th.vsIntegration')}` }}
                      <UIcon v-if="sortKey === 'aheadInt'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="num sortable" :aria-sort="ariaSort('ageDays')">
                    <button type="button" class="th-sort" @click="toggleSort('ageDays')">
                      {{ ` ${t('branches.th.lastActivity')}` }}
                      <UIcon v-if="sortKey === 'ageDays'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="sortable" :aria-sort="ariaSort('authors')">
                    <button type="button" class="th-sort" @click="toggleSort('authors')">
                      {{ ` ${t('branches.th.authors')}` }}
                      <UIcon v-if="sortKey === 'authors'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="sortable" :aria-sort="ariaSort('pr')">
                    <button type="button" class="th-sort" @click="toggleSort('pr')">
                      {{ ` ${t('branches.th.pr')}` }}
                      <UIcon v-if="sortKey === 'pr'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th>{{ t('branches.label.github') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in rows" :key="`${r.repo}/${r.name}`">
                  <td class="font-medium whitespace-nowrap">
                    <a v-if="r.githubUrl" :href="r.githubUrl" target="_blank" rel="noopener" class="text-primary hover:underline">
                      {{ r.name }}
                    </a>
                    <span v-else>{{ r.name }}</span>
                  </td>
                  <td class="whitespace-nowrap text-muted">
                    <RouterLink :to="{ name: '/repos/[name]', params: { name: r.repo } }" class="hover:text-primary hover:underline">
                      {{ r.repo }}
                    </RouterLink>
                  </td>
                  <td class="whitespace-nowrap">
                    <UBadge
                      :color="statusBadge(r.status).color"
                      :variant="statusBadge(r.status).variant"
                      size="sm"
                    >
                      {{ statusBadge(r.status).label }}
                    </UBadge>
                    <UTooltip v-if="r.squashPousada" :text="t('branches.tooltip.squashReleased')">
                      <UBadge color="info" variant="soft" size="sm" class="ml-1">
                        {{ ` ${t('branches.badge.pousadaViaSquash')} ` }}
                      </UBadge>
                    </UTooltip>
                    <UTooltip v-else-if="r.abandonada" :text="t('branches.tooltip.abandonada', { n: BRANCH_STALE_DAYS })">
                      <UBadge color="warning" variant="subtle" size="sm" class="ml-1">
                        {{ ` ${t('branches.badge.abandonada')} ` }}
                      </UBadge>
                    </UTooltip>
                    <UTooltip v-else-if="r.vivaSemPr" :text="t('branches.tooltip.vivaSemPr')">
                      <UBadge color="warning" variant="subtle" size="sm" class="ml-1">
                        {{ ` ${t('branches.badge.vivaSemPr')} ` }}
                      </UBadge>
                    </UTooltip>
                  </td>
                  <td class="num" :class="r.aheadProd > 0 ? 'add' : 'text-dimmed'">
                    {{ r.aheadProd > 0 ? t('branches.value.plus', { n: fmtInt(r.aheadProd) }) : fmtInt(r.aheadProd) }}
                  </td>
                  <td class="num" :class="r.behindProd > 0 ? 'del' : 'text-dimmed'">
                    {{ r.behindProd > 0 ? t('branches.value.minus', { n: fmtInt(r.behindProd) }) : fmtInt(r.behindProd) }}
                  </td>
                  <td class="num whitespace-nowrap text-muted">
                    <template v-if="r.aheadInt != null && r.behindInt != null">
                      {{ ` ${t('branches.value.slash', { ahead: fmtInt(r.aheadInt), behind: fmtInt(r.behindInt) })}` }}
                    </template>
                    <span v-else class="text-dimmed">{{ t('branches.sep.dash') }}</span>
                  </td>
                  <td class="num whitespace-nowrap" :class="ageClass(r.ageDays)">
                    <UTooltip :text="fmtDate(r.lastActivity)">
                      <span>{{ fmtDaysAgo(r.lastActivity) }}</span>
                    </UTooltip>
                  </td>
                  <td class="whitespace-nowrap">
                    <UTooltip v-if="r.authorNames.length" :text="r.authorsAhead.join(', ')">
                      <span>
                        {{ r.authorNamesTop.join(', ') }}<span v-if="r.authorNames.length > 2" class="text-dimmed">{{ ` ${t('branches.value.plus', { n: r.authorNames.length - 2 })}` }}</span>
                      </span>
                    </UTooltip>
                    <span v-else class="text-dimmed">{{ t('branches.sep.dash') }}</span>
                  </td>
                  <td class="whitespace-nowrap">
                    <template v-if="r.pr">
                      <a :href="r.pr.url" target="_blank" rel="noopener" class="text-primary hover:underline">{{ t('branches.pr.ref', { n: r.pr.number }) }}</a>
                      <UBadge :color="r.pr.state === 'OPEN' ? 'success' : 'neutral'" variant="soft" size="sm" class="ml-1">
                        {{ r.pr.state === 'OPEN' ? t('branches.pr.open') : t('branches.pr.merged') }}
                      </UBadge>
                    </template>
                    <UTooltip
                      v-else
                      :text="githubError ? t('branches.pr.noLinkNoGh') : t('branches.pr.noLinkNoPr')"
                    >
                      <span class="text-dimmed">{{ t('branches.pr.noLink') }}</span>
                    </UTooltip>
                  </td>
                  <td>
                    <a
                      v-if="r.githubUrl"
                      :href="r.githubUrl"
                      target="_blank"
                      rel="noopener"
                      class="text-dimmed hover:text-primary"
                      :aria-label="t('branches.row.openGithub')"
                    >
                      <UIcon name="i-lucide-external-link" class="size-3.5" />
                    </a>
                    <span v-else class="text-dimmed">{{ t('branches.sep.dash') }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-dimmed text-xs px-4 pb-3 pt-2">
            {{ ` ${t('branches.table.footer', { n: BRANCH_STALE_DAYS })} ` }}
          </p>
        </TablePanel>
      </section>
    </div>
    <div v-else class="flex flex-col gap-4">
      <div class="grid gap-3 lg:grid-cols-3">
        <USkeleton v-for="i in 3" :key="i" class="h-40 rounded-lg" />
      </div>
      <USkeleton class="h-64 rounded-lg" />
    </div>
  </div>
</template>

<style scoped>
/* mesmo padrão do DevTable (botão de ordenação dentro do th) */
.th-sort {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  width: 100%;
  font: inherit;
  color: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}
.th-sort:hover {
  color: var(--ui-text-highlighted);
}
</style>
