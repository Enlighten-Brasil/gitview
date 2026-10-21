<script setup lang="ts">
import AlertStrip from '@/components/AlertStrip.vue'
import CommitsTimeline from '@/components/CommitsTimeline.vue'
import SummaryCards from '@/components/SummaryCards.vue'
import { stats } from '@/data'
</script>

<template>
  <div v-if="stats" class="flex flex-col gap-4">
    <SummaryCards />
    <AlertStrip />
    <CommitsTimeline />
  </div>
</template>
