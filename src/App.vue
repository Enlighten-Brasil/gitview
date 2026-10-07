<script setup lang="ts">
import { onMounted } from 'vue'
import { loadError, loadStats, stats } from './data'
import FilterBar from './components/FilterBar.vue'
import SummaryCards from './components/SummaryCards.vue'
import CommitsTimeline from './components/CommitsTimeline.vue'
import RepoMonthHeatmap from './components/RepoMonthHeatmap.vue'
import ActivityHeatmap from './components/ActivityHeatmap.vue'
import RepoShare from './components/RepoShare.vue'
import DevTable from './components/DevTable.vue'
import WeeklyChampions from './components/WeeklyChampions.vue'
import AuthorMonthHeatmap from './components/AuthorMonthHeatmap.vue'

onMounted(loadStats)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR')
}
</script>

<template>
  <h1>gitview</h1>
  <p class="subtitle">
    <template v-if="stats">
      gerado em {{ fmtDate(stats.generatedAt) }} — rode <code>pnpm collect</code> para atualizar
    </template>
    <template v-else>carregando…</template>
  </p>

  <div v-if="loadError" class="error-box">
    <p><b>Não consegui carregar os dados.</b></p>
    <p>{{ loadError }}</p>
    <p>Rode <code>pnpm collect</code> para gerar o <code>public/data/stats.json</code> a partir dos seus repos git.</p>
  </div>

  <template v-else-if="stats">
    <FilterBar />
    <SummaryCards />
    <CommitsTimeline />
    <div class="grid-2">
      <ActivityHeatmap />
      <RepoShare />
    </div>
    <div class="grid-2">
      <WeeklyChampions />
      <AuthorMonthHeatmap />
    </div>
    <RepoMonthHeatmap />
    <DevTable />
  </template>
</template>
