<script setup lang="ts">
import { burnout, type BurnoutRow } from '../data'

/** error: padrão preocupante (3+ fds seguidos ou ≥25% fora do horário); warning: atenção; success: pontual */
function status(b: BurnoutRow): { color: 'error' | 'warning' | 'success'; label: string } {
  if (b.weekendsActive >= 3 || b.offHoursPct >= 0.25) return { color: 'error', label: 'padrão' }
  if (b.weekend + b.night >= 5) return { color: 'warning', label: 'atenção' }
  return { color: 'success', label: 'pontual' }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-moon" class="size-4 text-secondary" />
        <span class="text-sm font-semibold text-highlighted">Fora do horário — últimas 8 semanas</span>
      </div>
    </template>

    <p v-if="burnout.length === 0" class="text-muted text-sm">
      Nenhum commit de fim de semana ou madrugada no período. 👍
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>dev</th>
            <th class="num">fds</th>
            <th class="num">madrugada</th>
            <th class="num">% fora do horário</th>
            <th class="num">fds ativos (últ. 4)</th>
            <th class="num">status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in burnout" :key="b.author">
            <td>{{ b.author }}</td>
            <td class="num">{{ b.weekend }}</td>
            <td class="num">{{ b.night }}</td>
            <td class="num">{{ Math.round(b.offHoursPct * 100) }}%</td>
            <td class="num">{{ b.weekendsActive }}/4</td>
            <td class="num">
              <UBadge :color="status(b).color" variant="soft">{{ status(b).label }}</UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        fds = sáb/dom · madrugada = 22h–6h · padrão = 3+ fds seguidos ou ≥25% fora do horário
      </p>
    </template>
  </UCard>
</template>
