<script setup lang="ts">
import AlertStrip from '@/components/AlertStrip.vue'
import CommitsTimeline from '@/components/CommitsTimeline.vue'
import PrFlow from '@/components/PrFlow.vue'
import RecentReleases from '@/components/RecentReleases.vue'
import SummaryCards from '@/components/SummaryCards.vue'
import TeamPulse from '@/components/TeamPulse.vue'
import TopDevs from '@/components/TopDevs.vue'
import TypeMix from '@/components/TypeMix.vue'
import { stats } from '@/data'
</script>

<template>
  <div v-if="stats" class="flex flex-col gap-4">
    <!-- números → alertas → ritmo → entrega → pessoas -->
    <SummaryCards />
    <AlertStrip />
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <CommitsTimeline class="lg:col-span-2" />
      <TypeMix />
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PrFlow />
      <RecentReleases />
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <TopDevs />
      <TeamPulse />
    </div>
  </div>
</template>
