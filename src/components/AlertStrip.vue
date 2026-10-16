<script setup lang="ts">
/**
 * Faixa de alertas da Visão geral — os sinais de gestão que antes exigiam
 * caçar em /prs e /health. Cada alerta é um deep-link para a casa canônica
 * da métrica. Só mostra o que está fora do saudável (zero = some).
 */
import { computed } from 'vue'
import { burnout, pace, stats } from '../data'
import { mergedWithoutReview, stalePrs } from '../github'
import { releases } from '../releases'

interface Alert {
  icon: string
  value: string | number
  label: string
  to: string
  severity: 'error' | 'warning'
}

const DAY = 86_400_000

const alerts = computed<Alert[]>(() => {
  const out: Alert[] = []

  // PRs parados há 14+ dias (mesmo threshold do painel em /prs)
  const stale = stalePrs(14).length
  if (stale > 0)
    out.push({ icon: 'i-lucide-hourglass', value: stale, label: stale === 1 ? 'PR parado há 14+ dias' : 'PRs parados há 14+ dias', to: '/prs#abertos', severity: stale >= 5 ? 'error' : 'warning' })

  // merge sem review no período (alto = ≥20%, atenção = ≥10% — mesmo de /health)
  const noReview = mergedWithoutReview.value
  if (noReview.pct >= 10)
    out.push({ icon: 'i-lucide-git-pull-request-closed', value: `${noReview.pct}%`, label: 'dos merges sem review', to: '/prs#reviews', severity: noReview.pct >= 20 ? 'error' : 'warning' })

  // ritmo caindo: <60% do próprio ritmo das 8 semanas anteriores (mesmo do PaceAlert)
  const falling = pace.value.filter(r => r.ratio != null && r.ratio < 0.6).length
  if (falling > 0)
    out.push({ icon: 'i-lucide-trending-down', value: falling, label: falling === 1 ? 'dev abaixo do ritmo' : 'devs abaixo do ritmo', to: '/devs', severity: 'warning' })

  // fora do horário em padrão preocupante (3+ fds seguidos ou ≥25% — idem BurnoutWatch)
  const offHours = burnout.value.filter(b => b.weekendsActive >= 3 || b.offHoursPct >= 0.25).length
  if (offHours > 0)
    out.push({ icon: 'i-lucide-moon', value: offHours, label: offHours === 1 ? 'dev em padrão fora do horário' : 'devs em padrão fora do horário', to: '/health', severity: 'error' })

  // repos com 50+ commits não liberados (badge vermelho do RepoTable)
  const unreleased = (releases.value?.repos ?? []).filter(r => r.unreleased >= 50).length
  if (unreleased > 0)
    out.push({ icon: 'i-lucide-tag', value: unreleased, label: unreleased === 1 ? 'repo com 50+ commits não liberados' : 'repos com 50+ commits não liberados', to: '/repos#tabela', severity: 'warning' })

  // devs sem commit há 21+ dias (idem InactiveWatch)
  const now = Date.now()
  const inactive = (stats.value?.perAuthor ?? []).filter(a => (now - new Date(a.lastCommit).getTime()) / DAY >= 21).length
  if (inactive > 0)
    out.push({ icon: 'i-lucide-pause-circle', value: inactive, label: inactive === 1 ? 'dev sem commit há 21+ dias' : 'devs sem commit há 21+ dias', to: '/health', severity: 'warning' })

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
