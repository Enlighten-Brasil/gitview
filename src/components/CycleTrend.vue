<script setup lang="ts">
import { computed } from 'vue'
import { cycleTrend, fmtDuration, github } from '../github'

const rows = computed(() => cycleTrend.value)

/** últimos 4 meses com dados em qualquer repo (header alinhado) */
const monthsHeader = computed(() => {
  const all = new Set<string>()
  for (const r of rows.value) for (const m of r.months) all.add(m.month)
  return [...all].sort().slice(-4)
})

function medianOf(r: { months: { month: string; medianHours: number; count: number }[] }, month: string) {
  return r.months.find(x => x.month === month)
}

function trend(r: { months: { medianHours: number }[]; rising: boolean }): { color: 'error' | 'warning' | 'success'; label: string } {
  if (r.rising) return { color: 'error', label: 'subindo' }
  const last3 = r.months.slice(-3)
  if (last3.length === 3 && last3[0].medianHours > last3[1].medianHours && last3[1].medianHours > last3[2].medianHours) {
    return { color: 'success', label: 'caindo' }
  }
  return { color: 'warning', label: 'estável' }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-trending-up" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">Tendência de cycle time — últimos 6 meses</span>
      </div>
    </template>

    <p v-if="!github" class="text-muted text-sm">
      Sem dados do GitHub — rode <code>pnpm collect:github</code>.
    </p>
    <p v-else-if="rows.length === 0" class="text-muted text-sm">
      Poucos PRs mergeados nos últimos 6 meses para medir tendência.
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>repo</th>
            <th class="num" v-for="m in monthsHeader" :key="m">{{ m }}</th>
            <th class="num">tendência</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.repo">
            <td class="font-medium">{{ r.repo }}</td>
            <td v-for="m in monthsHeader" :key="m" class="num whitespace-nowrap">
              <template v-if="medianOf(r, m)">
                {{ fmtDuration(medianOf(r, m)!.medianHours) }}
                <span class="text-dimmed text-xs">({{ medianOf(r, m)!.count }})</span>
              </template>
              <span v-else class="text-dimmed">—</span>
            </td>
            <td class="num">
              <UBadge :color="trend(r).color" variant="soft">{{ trend(r).label }}</UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        mediana do cycle time (criação → merge) por mês, com (n PRs) · subindo = 3 meses seguidos de alta · ignora o filtro de período
      </p>
    </template>
  </UCard>
</template>
