<script setup lang="ts">
import type { PaceRow } from '../data'
import { computed } from 'vue'
import { pace } from '../data'
import { fmtRatio } from '../format'
import { PACE_FALLING, PACE_RISING } from '../thresholds'

/** ritmo com o ratio já resolvido — as listas de alerta nunca mostram null */
type PaceAlertRow = Omit<PaceRow, 'ratio'> & { ratio: number }

/** queda: ritmo atual <= PACE_FALLING da média anterior; acelerando: >= PACE_RISING */
const falling = computed(() => pace.value.filter((r): r is PaceAlertRow => r.ratio !== null && r.ratio <= PACE_FALLING))
const rising = computed(() => pace.value.filter((r): r is PaceAlertRow => r.ratio !== null && r.ratio >= PACE_RISING))

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
      Todo mundo no ritmo habitual. <UIcon name="i-lucide-thumbs-up" class="size-4 align-[-2px]" />
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
                {{ pct(r.ratio) }}
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
                {{ pct(r.ratio) }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- janela fixa (categoria do AGENTS.md) — o recorte de escopo vale, o de período não -->
    <p class="text-dimmed text-xs mt-2.5">
      segue o escopo, ignora o período
    </p>
  </UCard>
</template>
