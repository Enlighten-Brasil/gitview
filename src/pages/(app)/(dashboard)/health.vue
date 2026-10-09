<script setup lang="ts">
import BurnoutWatch from '@/components/BurnoutWatch.vue'
import OffHoursPeriod from '@/components/OffHoursPeriod.vue'
import FixHotspots from '@/components/FixHotspots.vue'
import ReviewBottleneck from '@/components/ReviewBottleneck.vue'
import PrStaleAlert from '@/components/PrStaleAlert.vue'
import ReviewCoverage from '@/components/ReviewCoverage.vue'
import CycleTrend from '@/components/CycleTrend.vue'
import InactiveWatch from '@/components/InactiveWatch.vue'
import BusFactor from '@/components/BusFactor.vue'
</script>

<template>
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
