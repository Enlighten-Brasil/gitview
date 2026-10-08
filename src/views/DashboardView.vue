<script setup lang="ts">
import { onMounted } from 'vue'
import { loadError, stats } from '../data'
import { github, githubError } from '../github'
import { activeTab, syncUrlNow } from '../urlState'
import SummaryCards from '../components/SummaryCards.vue'
import CommitsTimeline from '../components/CommitsTimeline.vue'
import RepoMonthHeatmap from '../components/RepoMonthHeatmap.vue'
import ActivityHeatmap from '../components/ActivityHeatmap.vue'
import RepoShare from '../components/RepoShare.vue'
import DevTable from '../components/DevTable.vue'
import WeeklyChampions from '../components/WeeklyChampions.vue'
import AuthorMonthHeatmap from '../components/AuthorMonthHeatmap.vue'
import PaceAlert from '../components/PaceAlert.vue'
import BurnoutWatch from '../components/BurnoutWatch.vue'
import OffHoursPeriod from '../components/OffHoursPeriod.vue'
import BusFactor from '../components/BusFactor.vue'
import FixHotspots from '../components/FixHotspots.vue'
import ReviewBottleneck from '../components/ReviewBottleneck.vue'
import PrStaleAlert from '../components/PrStaleAlert.vue'
import ReviewCoverage from '../components/ReviewCoverage.vue'
import InactiveWatch from '../components/InactiveWatch.vue'
import CycleTrend from '../components/CycleTrend.vue'
import CommitTypes from '../components/CommitTypes.vue'
import LinesFlow from '../components/LinesFlow.vue'
import RepoTable from '../components/RepoTable.vue'
import PrSummaryCards from '../components/PrSummaryCards.vue'
import PrOpenTable from '../components/PrOpenTable.vue'
import PrCycleTime from '../components/PrCycleTime.vue'
import PrReviews from '../components/PrReviews.vue'

const tabs = [
  { label: 'Visão geral', icon: 'i-lucide-layout-dashboard', slot: 'overview' as const, value: 'overview' },
  { label: 'Time', icon: 'i-lucide-users', slot: 'team' as const, value: 'team' },
  { label: 'Saúde', icon: 'i-lucide-heart-pulse', slot: 'health' as const, value: 'health' },
  { label: 'Repos', icon: 'i-lucide-git-branch', slot: 'repos' as const, value: 'repos' },
  { label: 'Pull requests', icon: 'i-lucide-git-pull-request', slot: 'prs' as const, value: 'prs' },
]

// ao voltar da página do dev (router), regrava a query string com o estado atual
onMounted(syncUrlNow)
</script>

<template>
  <div v-if="loadError" class="max-w-[1320px] w-full mx-auto px-5 py-6">
    <UAlert
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Não consegui carregar os dados"
    >
      <template #description>
        {{ loadError }} — rode <code>pnpm collect</code> para gerar o <code>public/data/stats.json</code> a partir dos seus repos git.
      </template>
    </UAlert>
  </div>

  <template v-else-if="stats">
    <!-- faixa de abas colada no navbar, full-bleed (integrada à moldura header+sidebar),
         sticky no scroll; padding lateral zero alinha o label da 1ª aba com o título do navbar
         (o trigger do variant=link já tem padding interno próprio) -->
    <UTabs
      v-model="activeTab"
      :items="tabs"
      variant="link"
      class="w-full"
      :ui="{
        list: 'sticky top-0 z-10 bg-default border-b border-default pl-5',
        content: 'max-w-[1320px] w-full mx-auto px-5 py-6',
      }"
    >
      <template #overview>
        <div class="flex flex-col gap-4">
          <SummaryCards />
          <CommitsTimeline />
          <ActivityHeatmap />
        </div>
      </template>

      <template #team>
        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <WeeklyChampions />
            <PaceAlert />
          </div>
          <AuthorMonthHeatmap />
          <DevTable />
        </div>
      </template>

      <template #health>
        <div class="flex flex-col gap-4">
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <BurnoutWatch />
            <OffHoursPeriod />
          </div>
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <FixHotspots />
            <ReviewBottleneck />
          </div>
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <PrStaleAlert />
            <ReviewCoverage />
          </div>
          <CycleTrend />
          <InactiveWatch />
          <BusFactor />
        </div>
      </template>

      <template #repos>
        <div class="flex flex-col gap-4">
          <RepoTable />
          <LinesFlow />
          <RepoShare />
          <RepoMonthHeatmap />
          <CommitTypes />
        </div>
      </template>

      <template #prs>
        <UAlert
          v-if="githubError"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Sem dados do GitHub"
          :description="`${githubError} para gerar o public/data/github.json (requer gh autenticado).`"
        />
        <div v-else-if="github" class="flex flex-col gap-4">
          <PrSummaryCards />
          <PrOpenTable />
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PrCycleTime />
            <PrReviews />
          </div>
        </div>
        <div v-else class="flex flex-col gap-4">
          <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
            <USkeleton v-for="i in 5" :key="i" class="h-20 rounded-lg" />
          </div>
          <USkeleton class="h-64 rounded-lg" />
        </div>
      </template>
    </UTabs>
  </template>

  <!-- skeleton enquanto o stats.json não chega -->
  <div v-else class="flex flex-col gap-4">
    <div class="border-b border-default pl-5 flex gap-4 py-2.5">
      <USkeleton v-for="i in 5" :key="i" class="h-5 w-24" />
    </div>
    <div class="max-w-[1320px] w-full mx-auto px-5 py-6 flex flex-col gap-4">
      <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <USkeleton v-for="i in 6" :key="i" class="h-20 rounded-lg" />
      </div>
      <USkeleton class="h-72 rounded-lg" />
      <USkeleton class="h-56 rounded-lg" />
    </div>
  </div>
</template>
