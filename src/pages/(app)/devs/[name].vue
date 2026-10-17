<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDevCharts } from '@/charts/useDevCharts'
import ChartPanel from '@/components/ChartPanel.vue'
import CommitsTimeline from '@/components/CommitsTimeline.vue'
import DetailHeader from '@/components/DetailHeader.vue'
import DevCommitsTable from '@/components/dev/DevCommitsTable.vue'
import DevPrOpen from '@/components/dev/DevPrOpen.vue'
import DevStatCards from '@/components/dev/DevStatCards.vue'
import { loadCommits, stats } from '@/data'

// rota de detalhe do dev (era /dev/:name — alias mantém os links antigos)
definePage({
  alias: '/dev/:name',
  meta: {
    section: 'dashboards',
    filters: 'period',
  },
})

const route = useRoute()
const dev = computed(() => String(route.params.name ?? ''))

onMounted(loadCommits)

const authorStats = computed(() =>
  stats.value?.perAuthor.find(a => a.author === dev.value) ?? null,
)

// sugestões de nomes parecidos quando o dev não existe (fuzzy por substring/lower)
const suggestions = computed(() => {
  if (!stats.value || authorStats.value)
    return []
  const q = dev.value.toLowerCase()
  if (!q)
    return []
  const all = stats.value.perAuthor.map(a => a.author)
  const exact = all.filter(n => n.toLowerCase().includes(q) || q.includes(n.toLowerCase()))
  const pool = exact.length
    ? exact
    : all.filter((n) => {
        const nl = n.toLowerCase()
        // tokens em comum (nome/sobrenome parcial)
        const qt = q.split(/[\s._-]+/).filter(Boolean)
        const nt = nl.split(/[\s._-]+/).filter(Boolean)
        return qt.some(t => nt.some(x => x.startsWith(t) || t.startsWith(x)))
      })
  return pool.slice(0, 5)
})

// gráficos do perfil: donut por repositório + heatmap de horários (issue #41);
// a timeline reusa o CommitsTimeline com a prop `author`
const { repoOption, heatOption, heatTitle } = useDevCharts(dev)
</script>

<template>
  <div class="max-w-[1320px] w-full mx-auto px-5 py-6 flex flex-col gap-4">
    <!-- cabeçalho do perfil -->
    <DetailHeader to="/" back-label="dashboard" icon="i-lucide-user" :title="dev" />

    <div v-if="stats && !authorStats" class="flex flex-col gap-3">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-lucide-user-x"
        title="Dev não encontrado"
        description="Esse nome não aparece nos commits coletados. Confere a grafia ou rode pnpm collect."
      />
      <div v-if="suggestions.length" class="text-sm">
        <p class="text-dimmed mb-2">
          Quis dizer:
        </p>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="s in suggestions"
            :key="s"
            :to="{ name: '/devs/[name]', params: { name: s } }"
            color="neutral"
            variant="soft"
            size="sm"
            :label="s"
            icon="i-lucide-user-round"
          />
        </div>
      </div>
    </div>

    <template v-else-if="authorStats">
      <!-- cards -->
      <DevStatCards :dev="dev" />

      <!-- gráficos -->
      <CommitsTimeline :author="dev" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartPanel title="Distribuição por repositório" icon="i-lucide-chart-pie" :option="repoOption" />
        <ChartPanel :title="heatTitle" icon="i-lucide-clock" :option="heatOption" />
      </div>

      <!-- PRs abertos do dev -->
      <DevPrOpen :dev="dev" />

      <!-- últimos commits -->
      <DevCommitsTable :dev="dev" />
    </template>
  </div>
</template>
