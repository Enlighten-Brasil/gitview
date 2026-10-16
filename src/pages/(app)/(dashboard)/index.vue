<script setup lang="ts">
import AlertStrip from '@/components/AlertStrip.vue'
import CommitsTimeline from '@/components/CommitsTimeline.vue'
import SummaryCards from '@/components/SummaryCards.vue'
import { loadError, stats } from '@/data'
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
    <AlertStrip />
    <CommitsTimeline />
  </div>
</template>
