<script setup lang="ts">
import { computed } from 'vue'
import { offHoursPeriod, rangeLabel, type OffHoursRow } from '../data'

/** visão de longo prazo — complementa o BurnoutWatch (que olha só as últimas 8 semanas) */
const rows = computed(() => offHoursPeriod.value)

function status(b: OffHoursRow): { color: 'error' | 'warning' | 'success'; label: string; hex: string } {
  if (b.offHoursPct >= 0.25) return { color: 'error', label: 'padrão', hex: 'var(--ui-error)' }
  if (b.offHoursPct >= 0.15) return { color: 'warning', label: 'atenção', hex: 'var(--ui-warning)' }
  return { color: 'success', label: 'pontual', hex: 'var(--ui-success)' }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-clock-alert" class="size-4 text-secondary" />
        <span class="text-sm font-semibold text-highlighted">Fora do horário — {{ rangeLabel }}</span>
      </div>
    </template>

    <p v-if="rows.length === 0" class="text-muted text-sm">
      Nenhum commit de fim de semana ou madrugada no período. 👍
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>dev</th>
            <th style="width: 26%">% fora do horário</th>
            <th class="num">fds</th>
            <th class="num">madrugada</th>
            <th class="num">commits</th>
            <th class="num">status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in rows" :key="b.author">
            <td>{{ b.author }}</td>
            <td>
              <div class="flex items-center gap-2">
                <div class="h-2 flex-1 rounded bg-accented overflow-hidden">
                  <div class="h-full rounded" :style="{ width: `${Math.round(b.offHoursPct * 100)}%`, background: status(b).hex }" />
                </div>
                <span class="num text-xs w-9">{{ Math.round(b.offHoursPct * 100) }}%</span>
              </div>
            </td>
            <td class="num">{{ b.weekend }}</td>
            <td class="num">{{ b.night }}</td>
            <td class="num">{{ b.total }}</td>
            <td class="num">
              <UBadge :color="status(b).color" variant="soft">{{ status(b).label }}</UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        fds = sáb/dom · madrugada = 22h–6h · padrão = ≥25% fora do horário no período · devs com &lt;20 commits no período são ignorados
      </p>
    </template>
  </UCard>
</template>
