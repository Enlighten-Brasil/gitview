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
    title: 'Branches',
  },
})

onMounted(loadBranches)
// mapeamento e-mail→dev dos autores à frente (o loader tem cache — sem 2º fetch)
onMounted(loadTeam)

const router = useRouter()

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
    case 'production': return { label: 'produção', color: 'neutral', variant: 'outline' }
    case 'integration': return { label: 'integração', color: 'info', variant: 'subtle' }
    case 'feature': return { label: 'feature', color: 'primary', variant: 'subtle' }
    case 'bot': return { label: 'bot', color: 'neutral', variant: 'soft' }
    case 'pousada': return { label: 'pousada', color: 'success', variant: 'subtle' }
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
      title="Sem dados de branches"
      :description="`${branchesError}. O inventário vem da coleta FULL — a recoleta light não atualiza o branches.json.`"
    />
    <div v-else-if="branches" class="flex flex-col gap-4">
      <!-- frescor do inventário + cobertura do vínculo PR↔branch -->
      <div class="flex flex-wrap items-center gap-3 text-xs">
        <UTooltip v-if="branchesAge" :text="`branches coletadas em ${fmtDateTime(branchesAge.generatedAt)} — só a coleta completa atualiza`">
          <span
            class="inline-flex items-center gap-1"
            :class="branchesAge.stale ? 'text-warning' : 'text-dimmed'"
          >
            <UIcon :name="branchesAge.stale ? 'i-lucide-triangle-alert' : 'i-lucide-clock'" class="size-3.5" />
            inventário {{ branchesAge.label }}
          </span>
        </UTooltip>
        <span class="inline-flex items-center gap-1 text-dimmed">
          <UIcon name="i-lucide-list-tree" class="size-3.5" />
          {{ branchRows.length }} branches em {{ repoCount }} repos
        </span>
        <UTooltip
          v-if="prLinkCoverage && prLinkCoverage.pct < 100"
          :text="`${prLinkCoverage.withHead} de ${prLinkCoverage.total} PRs têm headRef — PRs de cache antigo (anteriores ao vínculo) ficam de fora do join; 'sem vínculo' não significa 'sem PR'. Uma coleta completa do GitHub normaliza.`"
        >
          <UBadge color="warning" variant="subtle" size="sm" icon="i-lucide-circle-alert">
            vínculo PR↔branch: cobertura parcial ({{ prLinkCoverage.pct }}%)
          </UBadge>
        </UTooltip>
      </div>

      <UAlert
        v-if="githubError"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Sem dados do GitHub"
        :description="`${githubError} — o vínculo PR↔branch degrada para 'sem vínculo' e os status derivados (viva-sem-PR, pousada via squash) ficam desligados.`"
      />

      <!-- cards de populações disjuntas + desvio develop×prod por repo -->
      <div class="grid gap-3 lg:grid-cols-3 items-start">
        <section id="pousadas" class="scroll-mt-16">
          <UCard :ui="{ body: 'p-4 flex flex-col gap-2' }">
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-plane-landing" class="size-4 shrink-0 text-success" />
              <span class="text-sm font-semibold text-highlighted">Pousadas — podem ser limpas</span>
              <UBadge color="success" variant="subtle" size="sm" class="ml-auto shrink-0">
                {{ pousadas.length }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              ahead 0 (já mergeada) ou liberada via squash-merge, sem atividade há {{ BRANCH_STALE_DAYS }}+ dias.
            </p>
            <ul v-if="pousadas.length" class="flex flex-col gap-1 text-xs">
              <li v-for="b in pousadasTop" :key="`${b.repo}/${b.name}`" class="flex items-center gap-1.5 min-w-0">
                <RouterLink :to="{ name: '/repos/[name]', params: { name: b.repo } }" class="text-muted hover:text-primary shrink-0">
                  {{ b.repo }}
                </RouterLink>
                <span class="text-dimmed shrink-0">·</span>
                <a v-if="b.githubUrl" :href="b.githubUrl" target="_blank" rel="noopener" class="text-primary hover:underline truncate">
                  {{ b.name }}
                </a>
                <span v-else class="truncate">{{ b.name }}</span>
                <UTooltip v-if="b.squashPousada" text="liberada via squash-merge — o ahead > 0 é história reescrita, não trabalho pendente">
                  <UBadge color="info" variant="soft" size="sm" class="shrink-0">
                    squash
                  </UBadge>
                </UTooltip>
              </li>
            </ul>
            <p v-else class="text-xs text-dimmed">
              Nenhuma branch pousada nos filtros atuais.
            </p>
            <UButton
              v-if="pousadas.length"
              size="xs"
              color="neutral"
              variant="link"
              label="ver todas na tabela"
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
              <span class="text-sm font-semibold text-highlighted">Abandonadas — trabalho não liberado parado</span>
              <UBadge color="warning" variant="subtle" size="sm" class="ml-auto shrink-0">
                {{ abandonadas.length }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              ahead &gt; 0 sem PR aberto, paradas há {{ BRANCH_STALE_DAYS }}+ dias — o trabalho ainda não chegou à produção.
            </p>
            <ul v-if="abandonadas.length" class="flex flex-col gap-1 text-xs">
              <li v-for="b in abandonadasTop" :key="`${b.repo}/${b.name}`" class="flex items-center gap-1.5 min-w-0">
                <RouterLink :to="{ name: '/repos/[name]', params: { name: b.repo } }" class="text-muted hover:text-primary shrink-0">
                  {{ b.repo }}
                </RouterLink>
                <span class="text-dimmed shrink-0">·</span>
                <a v-if="b.githubUrl" :href="b.githubUrl" target="_blank" rel="noopener" class="text-primary hover:underline truncate">
                  {{ b.name }}
                </a>
                <span v-else class="truncate">{{ b.name }}</span>
                <span class="ml-auto text-dimmed shrink-0">+{{ fmtInt(b.aheadProd) }} · {{ b.ageDays }}d</span>
              </li>
            </ul>
            <p v-else class="text-xs text-dimmed">
              Nenhuma branch abandonada nos filtros atuais.
            </p>
            <UButton
              v-if="abandonadas.length"
              size="xs"
              color="neutral"
              variant="link"
              label="ver todas na tabela"
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
              <span class="text-sm font-semibold text-highlighted">develop × produção</span>
              <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto shrink-0">
                {{ integrationSkew.length }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              Desvio da ref de integração vs produção por repo: à frente = trabalho não liberado; atrás com ahead 0 = integração abandonada.
            </p>
            <ul v-if="integrationSkew.length" class="flex flex-col gap-1 text-xs max-h-40 overflow-auto">
              <li v-for="s in integrationSkew" :key="s.repo" class="flex items-center gap-1.5 min-w-0">
                <RouterLink :to="{ name: '/repos/[name]', params: { name: s.repo } }" class="text-primary hover:underline truncate">
                  {{ s.repo }}
                </RouterLink>
                <UTooltip v-if="s.stale" :text="`sem atividade há ${BRANCH_STALE_DAYS}+ dias`">
                  <UIcon name="i-lucide-hourglass" class="size-3 shrink-0 text-dimmed" />
                </UTooltip>
                <span class="ml-auto flex items-center gap-2 whitespace-nowrap shrink-0">
                  <UTooltip :text="`+${fmtInt(s.ahead)} commits à frente de produção (não liberados)`">
                    <span :class="s.ahead > 0 ? 'text-warning font-medium' : 'text-dimmed'">+{{ fmtInt(s.ahead) }}</span>
                  </UTooltip>
                  <UTooltip :text="s.ahead === 0 && s.behind > 0 ? `${fmtInt(s.behind)} commits atrás — integração abandonada (morta)` : `−${fmtInt(s.behind)} commits atrás de produção`">
                    <span :class="s.ahead === 0 && s.behind > 0 ? 'text-error font-medium' : 'text-dimmed'">−{{ fmtInt(s.behind) }}</span>
                  </UTooltip>
                </span>
              </li>
            </ul>
            <p v-else class="text-xs text-dimmed">
              Nenhuma ref de integração com desvio nos filtros atuais.
            </p>
          </UCard>
        </section>
      </div>

      <!-- tabela ordenável -->
      <section id="tabela" class="scroll-mt-16">
        <TablePanel title="Branches" icon="i-lucide-git-branch" :count="rows.length">
          <template #actions>
            <UButton
              v-if="quickFilter"
              size="xs"
              color="neutral"
              variant="subtle"
              :label="`só ${quickFilter}`"
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
                      branch
                      <UIcon v-if="sortKey === 'name'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="sortable" :aria-sort="ariaSort('repo')">
                    <button type="button" class="th-sort" @click="toggleSort('repo')">
                      repo
                      <UIcon v-if="sortKey === 'repo'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="sortable" :aria-sort="ariaSort('status')">
                    <button type="button" class="th-sort" @click="toggleSort('status')">
                      status
                      <UIcon v-if="sortKey === 'status'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="num sortable" :aria-sort="ariaSort('aheadProd')">
                    <button type="button" class="th-sort" @click="toggleSort('aheadProd')">
                      à frente
                      <UIcon v-if="sortKey === 'aheadProd'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="num sortable" :aria-sort="ariaSort('behindProd')">
                    <button type="button" class="th-sort" @click="toggleSort('behindProd')">
                      atrás
                      <UIcon v-if="sortKey === 'behindProd'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="num sortable" :aria-sort="ariaSort('aheadInt')">
                    <button type="button" class="th-sort" @click="toggleSort('aheadInt')">
                      vs integração
                      <UIcon v-if="sortKey === 'aheadInt'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="num sortable" :aria-sort="ariaSort('ageDays')">
                    <button type="button" class="th-sort" @click="toggleSort('ageDays')">
                      última atividade
                      <UIcon v-if="sortKey === 'ageDays'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="sortable" :aria-sort="ariaSort('authors')">
                    <button type="button" class="th-sort" @click="toggleSort('authors')">
                      autores à frente
                      <UIcon v-if="sortKey === 'authors'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th class="sortable" :aria-sort="ariaSort('pr')">
                    <button type="button" class="th-sort" @click="toggleSort('pr')">
                      PR
                      <UIcon v-if="sortKey === 'pr'" :name="sortAsc ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-3 shrink-0" />
                    </button>
                  </th>
                  <th>GitHub</th>
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
                    <UTooltip v-if="r.squashPousada" text="liberada via squash-merge — o ahead > 0 é história reescrita, não trabalho pendente">
                      <UBadge color="info" variant="soft" size="sm" class="ml-1">
                        pousada via squash
                      </UBadge>
                    </UTooltip>
                    <UTooltip v-else-if="r.abandonada" :text="`commits à frente de produção sem PR aberto, parados há ${BRANCH_STALE_DAYS}+ dias — trabalho não liberado`">
                      <UBadge color="warning" variant="subtle" size="sm" class="ml-1">
                        abandonada
                      </UBadge>
                    </UTooltip>
                    <UTooltip v-else-if="r.vivaSemPr" text="commits à frente de produção sem nenhum PR aberto">
                      <UBadge color="warning" variant="subtle" size="sm" class="ml-1">
                        viva sem PR
                      </UBadge>
                    </UTooltip>
                  </td>
                  <td class="num" :class="r.aheadProd > 0 ? 'add' : 'text-dimmed'">
                    {{ r.aheadProd > 0 ? `+${fmtInt(r.aheadProd)}` : '0' }}
                  </td>
                  <td class="num" :class="r.behindProd > 0 ? 'del' : 'text-dimmed'">
                    {{ r.behindProd > 0 ? `−${fmtInt(r.behindProd)}` : '0' }}
                  </td>
                  <td class="num whitespace-nowrap text-muted">
                    <template v-if="r.aheadInt != null && r.behindInt != null">
                      +{{ fmtInt(r.aheadInt) }} / −{{ fmtInt(r.behindInt) }}
                    </template>
                    <span v-else class="text-dimmed">—</span>
                  </td>
                  <td class="num whitespace-nowrap" :class="ageClass(r.ageDays)">
                    <UTooltip :text="fmtDate(r.lastActivity)">
                      <span>{{ fmtDaysAgo(r.lastActivity) }}</span>
                    </UTooltip>
                  </td>
                  <td class="whitespace-nowrap">
                    <UTooltip v-if="r.authorNames.length" :text="r.authorsAhead.join(', ')">
                      <span>
                        {{ r.authorNamesTop.join(', ') }}<span v-if="r.authorNames.length > 2" class="text-dimmed"> +{{ r.authorNames.length - 2 }}</span>
                      </span>
                    </UTooltip>
                    <span v-else class="text-dimmed">—</span>
                  </td>
                  <td class="whitespace-nowrap">
                    <template v-if="r.pr">
                      <a :href="r.pr.url" target="_blank" rel="noopener" class="text-primary hover:underline">#{{ r.pr.number }}</a>
                      <UBadge :color="r.pr.state === 'OPEN' ? 'success' : 'neutral'" variant="soft" size="sm" class="ml-1">
                        {{ r.pr.state === 'OPEN' ? 'aberto' : 'mergeado' }}
                      </UBadge>
                    </template>
                    <UTooltip
                      v-else
                      :text="githubError ? 'sem dados do GitHub — vínculo indisponível' : 'nenhum PR com headRef para esta branch — cache antigo pode não ter o campo (cobertura parcial)'"
                    >
                      <span class="text-dimmed">sem vínculo</span>
                    </UTooltip>
                  </td>
                  <td>
                    <a
                      v-if="r.githubUrl"
                      :href="r.githubUrl"
                      target="_blank"
                      rel="noopener"
                      class="text-dimmed hover:text-primary"
                      aria-label="abrir a branch no GitHub"
                    >
                      <UIcon name="i-lucide-external-link" class="size-3.5" />
                    </a>
                    <span v-else class="text-dimmed">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="text-dimmed text-xs px-4 pb-3 pt-2">
            inventário atual (coleta completa) — não segue o filtro de período · à frente/atrás = commits SEM merges vs a ref de produção de cada repo · pousada = ahead 0 e ≥ {{ BRANCH_STALE_DAYS }} dias sem atividade · "sem vínculo" ≠ "sem PR": PRs de cache antigo podem não ter headRef
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
