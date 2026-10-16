<script setup lang="ts">
import ActivityHeatmap from '@/components/ActivityHeatmap.vue'
import AuthorMonthHeatmap from '@/components/AuthorMonthHeatmap.vue'
import DevTable from '@/components/DevTable.vue'
import PaceAlert from '@/components/PaceAlert.vue'
import PeriodHighlight from '@/components/PeriodHighlight.vue'
import WeeklyChampions from '@/components/WeeklyChampions.vue'
</script>

<template>
  <div class="flex flex-col gap-4">
    <PeriodHighlight />
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <WeeklyChampions />
      <PaceAlert />
    </div>
    <AuthorMonthHeatmap />
    <ActivityHeatmap />
    <DevTable />
  </div>
</template>
