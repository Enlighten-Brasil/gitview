<script setup lang="ts">
import { computed } from 'vue'
import { reviewShareByRepo } from '../github'

/** repos com volume mínimo de reviews — concentração em 1 pessoa é gargalo de fluxo */
const rows = computed(() =>
  reviewShareByRepo.value.filter(r => r.total >= 5),
)

function risk(r: { topShare: number }): { color: 'error' | 'warning' | 'success'; label: string; hex: string } {
  if (r.topShare >= 0.7) return { color: 'error', label: 'gargalo', hex: 'var(--ui-error)' }
  if (r.topShare >= 0.5) return { color: 'warning', label: 'atenção', hex: 'var(--ui-warning)' }
  return { color: 'success', label: 'ok', hex: 'var(--ui-success)' }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-check" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">Gargalo de review — quem segura os PRs</span>
      </div>
    </template>

    <p v-if="rows.length === 0" class="text-muted text-sm">
      Sem reviews suficientes no período filtrado.
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>repo</th>
            <th style="width: 34%">concentração</th>
            <th>reviewer principal</th>
            <th class="num">reviews</th>
            <th class="num">status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.repo">
            <td class="font-medium">{{ r.repo }}</td>
            <td>
              <div class="flex items-center gap-2">
                <div class="h-2 flex-1 rounded bg-accented overflow-hidden">
                  <div class="h-full rounded" :style="{ width: `${Math.round(r.topShare * 100)}%`, background: risk(r).hex }" />
                </div>
                <span class="num text-xs w-9">{{ Math.round(r.topShare * 100) }}%</span>
              </div>
            </td>
            <td>{{ r.topReviewer }}</td>
            <td class="num">{{ r.total }}</td>
            <td class="num">
              <UBadge :color="risk(r).color" variant="soft">{{ risk(r).label }}</UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        gargalo = 1 pessoa faz ≥70% das reviews do repo · atenção = ≥50% · repos com &lt;5 reviews no período são ignorados
      </p>
    </template>
  </UCard>
</template>
