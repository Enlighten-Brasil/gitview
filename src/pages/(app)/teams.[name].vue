<script setup lang="ts">
/**
 * Dashboard do time (issue #9) — reutiliza os painéis do dashboard com
 * filters.authors TRAVADOS nos membros (fonte: team.json). Escopo de filtros
 * 'team': sidebar e URL carregam período + repos; os devs não aparecem na URL
 * (o caminho /teams/<nome> já é o contexto compartilhável).
 *
 * Time renomeado: os nomes antigos ficam em team.renamedFrom (gravados pelo
 * editor /teams) e caem num redirect — links compartilhados continuam vivos.
 * "ver como filtro livre" leva ao dashboard com ?devs=<membros> editável.
 */
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AuthorMonthHeatmap from '@/components/AuthorMonthHeatmap.vue'
import CommitsTimeline from '@/components/CommitsTimeline.vue'
import CommitTypes from '@/components/CommitTypes.vue'
import OffHoursPanel from '@/components/OffHoursPanel.vue'
import PrCycleTime from '@/components/PrCycleTime.vue'
import PrOpenTable from '@/components/PrOpenTable.vue'
import PrSummaryCards from '@/components/PrSummaryCards.vue'
import SummaryCards from '@/components/SummaryCards.vue'
import { filters, lockAuthors, rangeLabel } from '@/data'
import { github, githubError } from '@/github'
import { avatarBgClass, initialsOf, loadTeam, team, teamLoadError } from '@/team'

definePage({
  meta: {
    section: 'teams',
    filters: 'team',
  },
})

const route = useRoute()
const router = useRouter()
// chaves do dashboard por time (catálogo team.*) — escopo global como no FilterBar
const { t } = useI18n({ useScope: 'global' })

loadTeam()

const wanted = computed(() => String(route.params.name ?? ''))
const loaded = computed(() => team.value != null)

// NFC: o config pode ter sido editado em macOS (NFD) e a URL chega NFC —
// comparar sem normalizar faria um nome válido cair em "não encontrado"
const norm = (s: string) => s.normalize('NFC').toLowerCase()

/** casa exato (case-insensitive) — o nome atual do time */
const current = computed(() => {
  const w = norm(wanted.value)
  if (!w)
    return null
  return (team.value?.teams ?? []).find(t => norm(t.name) === w) ?? null
})

/** nome antigo (time renomeado) — mantém links compartilhados vivos via redirect */
const former = computed(() => {
  if (current.value)
    return null
  const w = norm(wanted.value)
  return (team.value?.teams ?? []).find(t => (t.renamedFrom ?? []).some(n => norm(n) === w)) ?? null
})

// immediate: com o team.json QUENTE (navegação interna após um loadTeam(true) —
// ex.: renomeou/salvou e voltou), 'former' já nasce verdadeiro no mount e sem
// immediate o watch nunca dispararia: a página ficaria presa no skeleton
watch(former, (t) => {
  if (t)
    router.replace({ path: `/teams/${encodeURIComponent(t.name)}`, query: route.query })
}, { immediate: true })

// travamento dos devs: mudou o time (ou o team.json chegou), trava os membros.
// O segundo watch devolve o lock se algo limpar/alterar filters.authors nesta
// rota (ex.: sanitize depois de um refresh de dados) — a fonte da verdade aqui
// é o time, não o filtro. A escrita é sempre pela ação lockAuthors (issue #39).
watch(current, (t) => {
  if (t)
    lockAuthors(t.members)
}, { immediate: true })
watch(() => filters.authors.join('\u0000'), () => {
  const t = current.value
  if (t && filters.authors.join('\u0000') !== t.members.join('\u0000'))
    lockAuthors(t.members)
})

// sugestões quando o nome não existe (mesma ideia da página do dev)
const suggestions = computed(() => {
  if (!loaded.value || current.value || former.value)
    return []
  const all = team.value?.teams ?? []
  const q = wanted.value.toLowerCase()
  const close = q
    ? all.filter(t => t.name.toLowerCase().includes(q) || q.includes(t.name.toLowerCase()))
    : []
  return (close.length ? close : all).slice(0, 5)
})

/** abre o dashboard com os membros como filtro de devs LIVRE (editável) */
function openAsFreeFilter() {
  const t = current.value
  if (t)
    router.push({ path: '/', query: { devs: t.members.join(',') } })
}

function goTeam(name: string) {
  router.push({ path: `/teams/${encodeURIComponent(name)}` })
}
</script>

<template>
  <div class="max-w-[1320px] w-full mx-auto px-5 py-6 flex flex-col gap-4">
    <!-- cabeçalho do time -->
    <div class="flex items-center gap-3 flex-wrap">
      <UButton
        to="/teams"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="ghost"
        size="sm"
        :label="t('team.dashboard.back')"
      />
      <span
        v-if="current"
        class="flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
        :style="current.color ? { backgroundColor: current.color } : undefined"
        :class="!current.color && avatarBgClass(current.name)"
      >
        {{ initialsOf(current.name) }}
      </span>
      <h1 class="text-xl font-bold text-highlighted">
        {{ current?.name ?? wanted }}
      </h1>
      <span v-if="current" class="text-xs text-dimmed">{{ t('team.dashboard.rangeSep', { range: rangeLabel }) }}</span>
      <UButton
        v-if="current"
        class="ml-auto"
        icon="i-lucide-sliders-horizontal"
        color="neutral"
        variant="soft"
        size="sm"
        :label="t('team.dashboard.freeFilter')"
        @click="openAsFreeFilter"
      />
    </div>
    <p v-if="current?.description" class="text-sm text-dimmed -mt-2">
      {{ current.description }}
    </p>

    <!-- membros (chips com link real pro perfil de commits — abre em nova aba/endereço copiável) -->
    <div v-if="current" class="flex flex-wrap gap-1.5 -mt-1">
      <UTooltip
        v-for="m in current.members"
        :key="m"
        :text="t('team.dashboard.memberTooltip', { name: m })"
      >
        <UButton
          :to="{ name: '/devs/[name]', params: { name: m } }"
          color="neutral"
          variant="soft"
          size="xs"
          class="rounded-full pe-2 ps-0.5"
        >
          <span :class="`flex size-5 items-center justify-center rounded-full text-[9px] font-semibold text-white ${avatarBgClass(m)}`">
            {{ initialsOf(m) }}
          </span>
          {{ m }}
        </UButton>
      </UTooltip>
      <p v-if="!current.members.length" class="text-xs text-dimmed italic">
        {{ t('team.dashboard.noMembers') }}
      </p>
    </div>

    <UAlert
      v-if="teamLoadError"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('team.loadError.title')"
      :description="t('team.loadError.description')"
    />

    <!-- skeleton enquanto o team.json chega (sem ele não dá pra travar os devs) -->
    <div v-else-if="!loaded || former" class="flex flex-col gap-4" aria-busy="true">
      <div class="grid grid-cols-2 md:grid-cols-6 gap-3">
        <USkeleton v-for="i in 6" :key="i" class="h-20 rounded-lg" />
      </div>
      <USkeleton class="h-64 rounded-lg" />
    </div>

    <template v-else-if="current">
      <SummaryCards />
      <CommitsTimeline />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AuthorMonthHeatmap />
        <CommitTypes />
      </div>

      <!-- PRs do time -->
      <UAlert
        v-if="githubError"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="t('team.dashboard.githubError.title')"
        :description="t('team.dashboard.githubError.description', { error: githubError })"
      />
      <template v-else-if="github">
        <PrSummaryCards />
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <PrOpenTable />
          <PrCycleTime />
        </div>
      </template>
      <div v-else class="flex flex-col gap-4">
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
          <USkeleton v-for="i in 5" :key="i" class="h-20 rounded-lg" />
        </div>
        <USkeleton class="h-64 rounded-lg" />
      </div>

      <OffHoursPanel />
    </template>

    <!-- time não existe -->
    <div v-else class="flex flex-col gap-3">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-users-round-x"
        :title="t('team.dashboard.notFound.title')"
        :description="t('team.dashboard.notFound.description')"
      />
      <div v-if="suggestions.length" class="text-sm">
        <p class="text-dimmed mb-2">
          {{ t('team.dashboard.suggestions') }}
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="s in suggestions"
            :key="s.name"
            color="neutral"
            variant="soft"
            size="sm"
            :label="s.name"
            icon="i-lucide-users-round"
            @click="goTeam(s.name)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
