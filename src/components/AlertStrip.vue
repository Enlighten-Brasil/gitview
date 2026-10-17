<script setup lang="ts">
/**
 * Faixa de alertas da Visão geral — os sinais de gestão que antes exigiam
 * caçar em /prs e /health. Cada alerta é um deep-link para a casa canônica
 * da métrica. Só mostra o que está fora do saudável (zero = some).
 */
import { computed } from 'vue'
import { burnout, isBot, pace, stats } from '../data'
import { daysSince } from '../format'
import { mergedWithoutReview, stalePrs } from '../github'
import { releases } from '../releases'
import {
  DEV_STALE_DAYS,
  MERGE_NO_REVIEW_AMBER,
  MERGE_NO_REVIEW_RED,
  OFF_HOURS_PCT,
  OFF_HOURS_WEEKENDS,
  PACE_FALLING,
  PR_STALE_DAYS,
  PR_STALE_ERROR_COUNT,
  UNRELEASED_RED,
} from '../thresholds'

interface Alert {
  icon: string
  value: string | number
  label: string
  to: string
  severity: 'error' | 'warning'
}

const alerts = computed<Alert[]>(() => {
  const out: Alert[] = []

  // PRs parados há PR_STALE_DAYS+ dias (mesmo threshold do painel em /prs)
  const stale = stalePrs(PR_STALE_DAYS).length
  if (stale > 0)
    out.push({ icon: 'i-lucide-hourglass', value: stale, label: stale === 1 ? `PR parado há ${PR_STALE_DAYS}+ dias` : `PRs parados há ${PR_STALE_DAYS}+ dias`, to: '/prs#abertos', severity: stale >= PR_STALE_ERROR_COUNT ? 'error' : 'warning' })

  // merge sem review no período (alto = ≥20%, atenção = ≥10% — mesmo de /health)
  const noReview = mergedWithoutReview.value
  if (noReview.pct >= MERGE_NO_REVIEW_AMBER * 100)
    out.push({ icon: 'i-lucide-git-pull-request-closed', value: `${noReview.pct}%`, label: 'dos merges sem review', to: '/prs#reviews', severity: noReview.pct >= MERGE_NO_REVIEW_RED * 100 ? 'error' : 'warning' })

  // ritmo caindo: <=50% do próprio ritmo das 8 semanas anteriores (mesmo do PaceAlert)
  const falling = pace.value.filter(r => r.ratio != null && r.ratio <= PACE_FALLING).length
  if (falling > 0)
    out.push({ icon: 'i-lucide-trending-down', value: falling, label: falling === 1 ? 'dev abaixo do ritmo' : 'devs abaixo do ritmo', to: '/devs', severity: 'warning' })

  // fora do horário em padrão preocupante (3+ fds seguidos ou ≥25% — idem BurnoutWatch)
  const offHours = burnout.value.filter(b => b.weekendsActive >= OFF_HOURS_WEEKENDS || b.offHoursPct >= OFF_HOURS_PCT).length
  if (offHours > 0)
    out.push({ icon: 'i-lucide-moon', value: offHours, label: offHours === 1 ? 'dev em padrão fora do horário' : 'devs em padrão fora do horário', to: '/health', severity: 'error' })

  // repos com 50+ commits não liberados (badge vermelho do RepoTable)
  const unreleased = (releases.value?.repos ?? []).filter(r => r.unreleased >= UNRELEASED_RED).length
  if (unreleased > 0)
    out.push({ icon: 'i-lucide-tag', value: unreleased, label: unreleased === 1 ? `repo com ${UNRELEASED_RED}+ commits não liberados` : `repos com ${UNRELEASED_RED}+ commits não liberados`, to: '/repos#tabela', severity: 'warning' })

  // devs sem commit há DEV_STALE_DAYS+ dias (idem InactiveWatch — ignora bots)
  const inactive = (stats.value?.perAuthor ?? []).filter(a => !isBot(a.author) && daysSince(a.lastCommit) >= DEV_STALE_DAYS).length
  if (inactive > 0)
    out.push({ icon: 'i-lucide-pause-circle', value: inactive, label: inactive === 1 ? `dev sem commit há ${DEV_STALE_DAYS}+ dias` : `devs sem commit há ${DEV_STALE_DAYS}+ dias`, to: '/health', severity: 'warning' })

  return out
})
</script>

<template>
  <div v-if="alerts.length" class="flex flex-wrap gap-2" aria-label="alertas do período">
    <RouterLink
      v-for="a in alerts"
      :key="a.label"
      :to="a.to"
      class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:border-primary"
      :class="a.severity === 'error' ? 'border-error/40 bg-error/5' : 'border-warning/40 bg-warning/5'"
    >
      <UIcon :name="a.icon" class="size-4" :class="a.severity === 'error' ? 'text-error' : 'text-warning'" />
      <b>{{ a.value }}</b>
      <span class="text-dimmed">{{ a.label }}</span>
      <UIcon name="i-lucide-arrow-right" class="size-3.5 text-dimmed" />
    </RouterLink>
  </div>
</template>
