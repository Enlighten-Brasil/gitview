<script setup lang="ts">
import { computed } from 'vue'
import { pace } from '../data'
import { fmtRatio } from '../format'
import { PACE_FALLING, PACE_RISING } from '../thresholds'

/** queda: ritmo atual <= PACE_FALLING da média anterior; acelerando: >= PACE_RISING */
const falling = computed(() => pace.value.filter(r => r.ratio !== null && r.ratio <= PACE_FALLING))
const rising = computed(() => pace.value.filter(r => r.ratio !== null && r.ratio >= PACE_RISING))

function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-activity" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-highlighted">Ritmo — últimas 4 semanas vs 8 anteriores</span>
      </div>
    </template>

    <p v-if="falling.length === 0 && rising.length === 0" class="text-muted text-sm">
      Todo mundo no ritmo habitual. 👍
    </p>

    <template v-if="falling.length">
      <h3 class="flex items-center gap-1.5 text-sm font-semibold text-error mt-1 mb-1.5">
        <UIcon name="i-lucide-trending-down" class="size-4" /> abaixo do ritmo
      </h3>
      <table class="data-table">
        <tbody>
          <tr v-for="r in falling" :key="r.author">
            <td>{{ r.author }}</td>
            <td class="num">
              {{ r.recent }} commits / 4 sem
            </td>
            <td class="num text-muted">
              média {{ fmtRatio(r.prevAvg) }}/sem
            </td>
            <td class="num">
              <UBadge color="error" variant="soft">
                {{ pct(r.ratio!) }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <template v-if="rising.length">
      <h3 class="flex items-center gap-1.5 text-sm font-semibold text-success mt-3 mb-1.5">
        <UIcon name="i-lucide-trending-up" class="size-4" /> acelerando
      </h3>
      <table class="data-table">
        <tbody>
          <tr v-for="r in rising" :key="r.author">
            <td>{{ r.author }}</td>
            <td class="num">
              {{ r.recent }} commits / 4 sem
            </td>
            <td class="num text-muted">
              média {{ fmtRatio(r.prevAvg) }}/sem
            </td>
            <td class="num">
              <UBadge color="success" variant="soft">
                {{ pct(r.ratio!) }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </UCard>
</template>
