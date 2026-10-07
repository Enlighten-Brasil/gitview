<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { loadError, loadStats, rangeLabel, stats } from './data'
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

const rangeText = rangeLabel

// desktop: botão no navbar recolhe a sidebar com 1 clique
// (o UDashboardSidebarCollapse nativo só cobre mobile; no desktop o default é arrastar a borda)
const sidebarCollapsed = ref(false)
</script>

<template>
  <UApp>
    <UDashboardGroup storage="localStorage" storage-key="gitview">
      <UDashboardSidebar v-model:collapsed="sidebarCollapsed" collapsible resizable>
        <template #header="{ collapsed }">
          <div v-if="!collapsed" class="flex items-center gap-2.5">
            <UIcon name="i-lucide-git-graph" class="size-5 text-primary shrink-0" />
            <span class="app-title" style="font-size: 20px">gitview</span>
            <UBadge color="primary" variant="soft" size="sm">
              v{{ version }}
            </UBadge>
          </div>
          <UIcon v-else name="i-lucide-git-graph" class="size-5 text-primary mx-auto" />
        </template>

        <template #default="{ collapsed, collapse }">
          <div v-if="collapsed" class="flex flex-col items-center pt-1">
            <UTooltip text="mostrar filtros">
              <UButton
                icon="i-lucide-sliders-horizontal"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="collapse(false)"
              />
            </UTooltip>
          </div>
          <FilterBar v-else />
        </template>

        <template #footer="{ collapsed }">
          <p v-if="!collapsed && stats" class="text-xs text-dimmed leading-relaxed">
            gerado em {{ fmtDate(stats.generatedAt) }}<br>
            rode <code class="bg-accented px-1 py-0.5 rounded">pnpm collect</code> para atualizar
          </p>
        </template>
      </UDashboardSidebar>

      <UDashboardPanel>
        <template #header>
          <UDashboardNavbar :title="rangeText">
            <template #leading>
              <UDashboardSidebarCollapse class="lg:hidden" />
              <UButton
                :icon="sidebarCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
                color="neutral"
                variant="ghost"
                class="hidden lg:inline-flex"
                :aria-label="sidebarCollapsed ? 'mostrar filtros' : 'ocultar filtros'"
                @click="sidebarCollapsed = !sidebarCollapsed"
              />
            </template>
          </UDashboardNavbar>
        </template>

        <template #body>
          <div class="max-w-[1320px] w-full mx-auto px-5 py-6">
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

            <div v-else-if="stats" class="flex flex-col gap-4">
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

              <h2 class="section-title">
                <UIcon name="i-lucide-heart-pulse" class="size-3.5" />
                saúde do time
              </h2>
              <BurnoutWatch />
              <BusFactor />

              <h2 class="section-title">
                <UIcon name="i-lucide-calendar-clock" class="size-3.5" />
                histórico
              </h2>
              <AuthorMonthHeatmap />
              <RepoMonthHeatmap />
              <DevTable />
            </div>
          </div>
        </template>
      </UDashboardPanel>
    </UDashboardGroup>
  </UApp>
</template>
