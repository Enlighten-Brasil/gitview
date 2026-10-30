<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { authorSelected, filteredWeekly, inPeriodMonth, isBot, lastNWeekKeys, pace, repoSelected, scopeMatches, stats } from '../data'
import { fmtRatio } from '../format'
import { offHoursShare } from '../overview'
import { displayPct } from '../risk'
import { OFF_HOURS_PCT, OFF_HOURS_PCT_ATTENTION, PACE_FALLING, PACE_RISING } from '../thresholds'
import { weeklyWins } from '../weeklyWinners'

/**
 * Pulso do time (Visão geral) — três sinais de gestão numa leitura só:
 * campeão da semana por evolução (fórmula de ../weeklyWinners), ritmo do time
 * (4 últimas semanas vs média das 8 anteriores) e fora do horário na janela
 * fixa de 8 semanas. As janelas fixas seguem a convenção do rodapé; o detalhe
 * vive em /devs e /health.
 */
const { t } = useI18n({ useScope: 'global' })

/** campeão da semana mais recente do período (issue #10 — evolução, não volume) */
const champion = computed(() => {
  const { wins } = weeklyWins(filteredWeekly.value, { isWeekInPeriod: inPeriodMonth })
  return wins[wins.length - 1] ?? null
})

/** ritmo do time: (commits nas últimas 4 sem / 4) ÷ média semanal das 8 anteriores */
const rhythm = computed(() => {
  const recent = pace.value.reduce((s, r) => s + r.recent, 0)
  const prevAvg = pace.value.reduce((s, r) => s + r.prevAvg, 0)
  return prevAvg > 0 ? (recent / 4) / prevAvg : null
})

/** fora do horário do time nas últimas 8 semanas (janela fixa) */
const offHours = computed(() => {
  const rows = (stats.value?.weekly ?? []).filter(r => repoSelected(r.repo) && authorSelected(r.author, isBot(r.author)) && scopeMatches(r))
  return offHoursShare(rows, lastNWeekKeys(8))
})

const offHoursPct = computed(() => displayPct(offHours.value.pct))
const offHoursLevel = computed(() =>
  offHoursPct.value >= OFF_HOURS_PCT ? 'error' : offHoursPct.value >= OFF_HOURS_PCT_ATTENTION ? 'warning' : 'success',
)
const rhythmLevel = computed(() =>
  rhythm.value != null && rhythm.value <= PACE_FALLING ? 'error' : rhythm.value != null && rhythm.value >= PACE_RISING ? 'success' : 'neutral',
)

// rótulos compostos no script (convenção — nada de texto cru no template)
const championLabel = computed(() => {
  const c = champion.value
  return c ? `${c.author} · ${t('chart.ratio', { n: fmtRatio(c.ratio) })}` : t('chart.dash')
})
const rhythmLabel = computed(() => rhythm.value != null ? t('chart.ratio', { n: fmtRatio(rhythm.value) }) : t('chart.dash'))
const offHoursLabel = computed(() => t('ui.pct', { n: Math.round(offHoursPct.value * 100) }))
const offHoursStatus = computed(() => `· ${offHoursLevel.value === 'success' ? t('ui.pulse.healthy') : t('ui.pulse.attention')}`)
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-activity" class="size-4 text-primary" />
        <span class="text-sm font-semibold text-highlighted">{{ t('ui.pulse.title') }}</span>
      </div>
    </template>

    <div class="flex flex-col gap-2 text-sm">
      <RouterLink to="/devs" class="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-primary">
        <UIcon name="i-lucide-trophy" class="size-4 text-warning" />
        <span class="text-muted">{{ t('ui.pulse.champion') }}</span>
        <span class="ml-auto font-semibold">{{ championLabel }}</span>
      </RouterLink>

      <RouterLink to="/devs" class="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-primary">
        <UIcon
          name="i-lucide-trending-up"
          class="size-4"
          :class="rhythmLevel === 'error' ? 'text-error rotate-180' : rhythmLevel === 'success' ? 'text-success' : 'text-muted'"
        />
        <span class="text-muted">{{ t('ui.pulse.rhythm') }}</span>
        <span class="ml-auto font-semibold">{{ rhythmLabel }}</span>
      </RouterLink>

      <RouterLink to="/health" class="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 hover:border-primary">
        <UIcon name="i-lucide-moon" class="size-4" :class="offHoursLevel === 'error' ? 'text-error' : offHoursLevel === 'warning' ? 'text-warning' : 'text-success'" />
        <span class="text-muted">{{ t('ui.pulse.offHours') }}</span>
        <span class="ml-auto font-semibold">
          {{ offHoursLabel }}
          <span class="text-xs font-normal" :class="offHoursLevel === 'error' ? 'text-error' : offHoursLevel === 'warning' ? 'text-warning' : 'text-success'">{{ offHoursStatus }}</span>
        </span>
      </RouterLink>
    </div>
  </UCard>
</template>
