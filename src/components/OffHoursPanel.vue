<script setup lang="ts">
/**
 * Fora do horário — fds + madrugada por dev. Um card, duas janelas:
 * "8 semanas" (fixo, detecta padrão recente: 3+ fds seguidos) e "período"
 * (segue o filtro da sidebar, ignora devs com <20 commits no período).
 * Funde os antigos BurnoutWatch (8sem) e OffHoursPeriod (período).
 */
import { computed, ref } from 'vue'
import { burnout, offHoursPeriod, rangeLabel } from '../data'

const mode = ref<'8sem' | 'periodo'>('8sem')

interface Row {
  author: string
  weekend: number
  night: number
  total: number
  offHoursPct: number
  weekendsActive?: number
}

const rows = computed<Row[]>(() => (mode.value === '8sem' ? burnout.value : offHoursPeriod.value))

/** padrão: ≥25% fora do horário (ou 3+ fds seguidos na janela de 8 semanas) */
function status(b: Row): { color: 'error' | 'warning' | 'success', label: string, hex: string } {
  if (b.offHoursPct >= 0.25 || (b.weekendsActive ?? 0) >= 3) return { color: 'error', label: 'padrão', hex: 'var(--ui-error)' }
  if (b.offHoursPct >= 0.15 || (b.weekend + b.night) >= 5) return { color: 'warning', label: 'atenção', hex: 'var(--ui-warning)' }
  return { color: 'success', label: 'pontual', hex: 'var(--ui-success)' }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2 flex-wrap">
        <UIcon name="i-lucide-moon" class="size-4 text-secondary" />
        <span class="text-sm font-semibold text-highlighted">Fora do horário</span>
        <div class="ml-auto flex gap-1">
          <UButton
            size="xs"
            :color="mode === '8sem' ? 'primary' : 'neutral'"
            :variant="mode === '8sem' ? 'soft' : 'ghost'"
            @click="mode = '8sem'"
          >
            8 semanas
          </UButton>
          <UButton
            size="xs"
            :color="mode === 'periodo' ? 'primary' : 'neutral'"
            :variant="mode === 'periodo' ? 'soft' : 'ghost'"
            @click="mode = 'periodo'"
          >
            {{ rangeLabel }}
          </UButton>
        </div>
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
            <th style="width: 22%">% fora do horário</th>
            <th class="num">fds</th>
            <th class="num">madrugada</th>
            <th class="num">commits</th>
            <th v-if="mode === '8sem'" class="num">fds ativos (últ. 4)</th>
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
            <td v-if="mode === '8sem'" class="num">{{ b.weekendsActive }}/4</td>
            <td class="num">
              <UBadge :color="status(b).color" variant="soft">{{ status(b).label }}</UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        fds = sáb/dom · madrugada = 22h–6h · padrão = ≥25% fora do horário<template v-if="mode === '8sem'"> ou 3+ fds seguidos (janela fixa de 8 semanas, ignora o filtro de período)</template><template v-else> no período · devs com &lt;20 commits no período são ignorados</template>
      </p>
    </template>
  </UCard>
</template>
