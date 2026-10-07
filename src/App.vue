<script setup lang="ts">
import { onMounted } from 'vue'
import { loadError, loadStats, stats } from './data'
import { version } from '../package.json'
import FilterBar from './components/FilterBar.vue'
import SummaryCards from './components/SummaryCards.vue'
import CommitsTimeline from './components/CommitsTimeline.vue'
import RepoMonthHeatmap from './components/RepoMonthHeatmap.vue'
import ActivityHeatmap from './components/ActivityHeatmap.vue'
import RepoShare from './components/RepoShare.vue'
import DevTable from './components/DevTable.vue'
import WeeklyChampions from './components/WeeklyChampions.vue'
import AuthorMonthHeatmap from './components/AuthorMonthHeatmap.vue'
import PaceAlert from './components/PaceAlert.vue'
import DevDetail from './components/DevDetail.vue'
import BurnoutWatch from './components/BurnoutWatch.vue'
import BusFactor from './components/BusFactor.vue'

onMounted(loadStats)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR')
}
</script>

<template>
  <UApp>
    <div class="max-w-[1320px] mx-auto px-5 pt-7 pb-14">
      <header class="flex items-baseline gap-4 flex-wrap mb-5">
        <h1 class="app-title flex items-center gap-3">
          gitview
          <UBadge color="primary" variant="soft">v{{ version }}</UBadge>
        </h1>
        <p class="text-muted text-sm">
          <template v-if="stats">
            gerado em {{ fmtDate(stats.generatedAt) }} · rode <code class="bg-accented px-1.5 py-0.5 rounded text-xs">pnpm collect</code> para atualizar
          </template>
          <template v-else>carregando…</template>
        </p>
      </header>

      <UAlert
        v-if="loadError"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Não consegui carregar os dados"
      >
        <template #description>
          {{ loadError }} — rode <code>pnpm collect</code> para gerar o <code>public/data/stats.json</code> a partir dos seus repos git.
        </template>
      </UAlert>

      <template v-else-if="stats">
        <FilterBar />
        <DevDetail />
        <SummaryCards />
        <CommitsTimeline />
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ActivityHeatmap />
          <RepoShare />
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <WeeklyChampions />
          <PaceAlert />
        </div>
        <BurnoutWatch />
        <BusFactor />
        <AuthorMonthHeatmap />
        <RepoMonthHeatmap />
        <DevTable />
      </template>
    </div>
  </UApp>
</template>
