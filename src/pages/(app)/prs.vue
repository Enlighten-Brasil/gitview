<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CycleTrend from '@/components/CycleTrend.vue'
import PrCycleTime from '@/components/PrCycleTime.vue'
import PrOpenTable from '@/components/PrOpenTable.vue'
import PrReviews from '@/components/PrReviews.vue'
import PrStaleAlert from '@/components/PrStaleAlert.vue'
import PrSummaryCards from '@/components/PrSummaryCards.vue'
/**
 * Pull requests — seção dedicada (migrada da tab "prs" do dashboard).
 * Âncoras (#abertos/#cycle-time/#reviews) alimentam o sub-nav contextual.
 * Casa canônica de PR: parados (PrStaleAlert) e tendência (CycleTrend) moram aqui.
 */
import { github, githubError } from '@/github'

definePage({
  meta: {
    section: 'prs',
    filters: 'full',
  },
})

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="max-w-[1320px] w-full mx-auto px-5 py-6">
    <UAlert
      v-if="githubError"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="t('branches.error.noGithub')"
      :description="t('branches.error.githubPrs', { msg: githubError })"
    />
    <div v-else-if="github" class="flex flex-col gap-4">
      <section id="abertos" class="flex flex-col gap-4 scroll-mt-16">
        <PrSummaryCards />
        <PrStaleAlert />
        <PrOpenTable />
      </section>
      <section id="cycle-time" class="flex flex-col gap-4 scroll-mt-16">
        <PrCycleTime />
        <CycleTrend />
      </section>
      <section id="reviews" class="scroll-mt-16">
        <PrReviews />
      </section>
    </div>
    <div v-else class="flex flex-col gap-4">
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <USkeleton v-for="i in 5" :key="i" class="h-20 rounded-lg" />
      </div>
      <USkeleton class="h-64 rounded-lg" />
    </div>
  </div>
</template>
