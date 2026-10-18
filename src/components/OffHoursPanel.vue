<script setup lang="ts">
/**
 * Fora do horário — fds + madrugada por dev. Um card, duas janelas:
 * "8 semanas" (fixo, detecta padrão recente: 3+ dos últimos 4 fins de semana ativos)
 * e "período" (segue o filtro da sidebar, ignora devs com <20 commits no período).
 * Funde os antigos BurnoutWatch (8sem) e OffHoursPeriod (período).
 */
import type { RiskStatus, RiskTier } from '../risk'
import { computed, ref } from 'vue'
import { burnout, offHoursPeriod, rangeLabel } from '../data'
import { statusOf } from '../risk'
import {
  OFF_HOURS_COUNT_ATTENTION,
  OFF_HOURS_MIN_COMMITS,
  OFF_HOURS_PCT,
  OFF_HOURS_PCT_ATTENTION,
  OFF_HOURS_WEEKENDS,
} from '../thresholds'
import RiskBar from './RiskBar.vue'

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

const RISK_TIERS: RiskTier[] = [
  { at: OFF_HOURS_PCT, color: 'error', label: 'padrão' },
  { at: OFF_HOURS_PCT_ATTENTION, color: 'warning', label: 'atenção' },
  { at: 0, color: 'success', label: 'pontual' },
]

/**
 * risco no eixo dos tiers: ≥25% fora do horário (ou 3+ dos últimos 4 fins de
 * semana ativos na janela de 8 semanas) vira "padrão". A contagem absoluta
 * (fds+madrugada ≥5) só tem
 * sentido na janela fixa de 8 semanas; no modo "período" (1–24 meses) ela
 * acumularia trivialmente — lá o status é só por pct (como no antigo
 * OffHoursPeriod). As condições fora do pct entram como piso no eixo.
 */
function riskScore(b: Row): number {
  if ((b.weekendsActive ?? 0) >= OFF_HOURS_WEEKENDS)
    return Math.max(b.offHoursPct, OFF_HOURS_PCT)
  if (mode.value === '8sem' && b.weekend + b.night >= OFF_HOURS_COUNT_ATTENTION)
    return Math.max(b.offHoursPct, OFF_HOURS_PCT_ATTENTION)
  return b.offHoursPct
}

function riskStatus(b: Row): RiskStatus {
  return statusOf(riskScore(b), RISK_TIERS)
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
            :aria-pressed="mode === '8sem'"
            @click="mode = '8sem'"
          >
            8 semanas
          </UButton>
          <UButton
            size="xs"
            :color="mode === 'periodo' ? 'primary' : 'neutral'"
            :variant="mode === 'periodo' ? 'soft' : 'ghost'"
            :aria-pressed="mode === 'periodo'"
            @click="mode = 'periodo'"
          >
            {{ rangeLabel }}
          </UButton>
        </div>
      </div>
    </template>

    <p v-if="rows.length === 0" class="text-muted text-sm">
      Nenhum commit de fim de semana ou madrugada no período. <UIcon name="i-lucide-thumbs-up" class="size-4 align-[-2px]" />
    </p>

    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>dev</th>
            <th style="width: 22%">
              % fora do horário
            </th>
            <th class="num">
              fds
            </th>
            <th class="num">
              madrugada
            </th>
            <th class="num">
              commits
            </th>
            <th v-if="mode === '8sem'" class="num">
              fds ativos (últ. 4)
            </th>
            <th class="num">
              status
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in rows" :key="b.author">
            <td>{{ b.author }}</td>
            <td>
              <RiskBar :pct="b.offHoursPct" :status="riskStatus(b)" />
            </td>
            <td class="num">
              {{ b.weekend }}
            </td>
            <td class="num">
              {{ b.night }}
            </td>
            <td class="num">
              {{ b.total }}
            </td>
            <td v-if="mode === '8sem'" class="num">
              {{ b.weekendsActive }}/4
            </td>
            <td class="num">
              <UBadge :color="riskStatus(b).color" variant="soft">
                {{ riskStatus(b).label }}
              </UBadge>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        fds = sáb/dom · madrugada = 22h–6h · padrão = ≥{{ Math.round(OFF_HOURS_PCT * 100) }}% fora do horário<template v-if="mode === '8sem'">
          ou {{ OFF_HOURS_WEEKENDS }}+ dos últimos 4 fins de semana ativos (janela fixa de 8 semanas, ignora o filtro de período)
        </template><template v-else>
          no período · devs com &lt;{{ OFF_HOURS_MIN_COMMITS }} commits no período são ignorados
        </template>
      </p>
    </template>
  </UCard>
</template>
