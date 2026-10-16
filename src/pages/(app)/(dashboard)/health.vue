<script setup lang="ts">
import BusFactor from '@/components/BusFactor.vue'
import FixHotspots from '@/components/FixHotspots.vue'
import InactiveWatch from '@/components/InactiveWatch.vue'
import OffHoursPanel from '@/components/OffHoursPanel.vue'
import ReviewBottleneck from '@/components/ReviewBottleneck.vue'
import ReviewCoverage from '@/components/ReviewCoverage.vue'
</script>

<template>
  <div class="flex flex-col gap-4">
    <OffHoursPanel />
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <FixHotspots />
      <ReviewBottleneck />
    </div>
    <ReviewCoverage />
    <InactiveWatch />
    <BusFactor />
  </div>
</template>
