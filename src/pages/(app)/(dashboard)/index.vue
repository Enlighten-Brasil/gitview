<script setup lang="ts">
import { loadError, stats } from '@/data'
import SummaryCards from '@/components/SummaryCards.vue'
import CommitsTimeline from '@/components/CommitsTimeline.vue'
import ActivityHeatmap from '@/components/ActivityHeatmap.vue'
</script>

<template>
  <div v-if="loadError" class="flex flex-col gap-4">
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

  <div v-else-if="stats" class="flex flex-col gap-4">
    <SummaryCards />
    <CommitsTimeline />
    <ActivityHeatmap />
  </div>
</template>
