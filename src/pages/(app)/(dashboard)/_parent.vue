<script setup lang="ts">
/**
 * Layout das abas do dashboard (visão geral / equipe / saúde) — cada aba é uma
 * rota aninhada; a faixa fica sticky no scroll do painel.
 * meta herdada pelos filhos: seção na rail + filtros 'full' na sidebar/URL.
 */
definePage({
  meta: {
    section: 'dashboards',
    filters: 'full',
  },
})

const tabs = [
  { label: 'Visão geral', icon: 'i-lucide-layout-dashboard', to: '/' },
  { label: 'Equipe', icon: 'i-lucide-users', to: '/devs' },
  { label: 'Saúde', icon: 'i-lucide-heart-pulse', to: '/health' },
]

const base = 'inline-flex items-center gap-1.5 py-2.5 px-2 text-sm font-medium border-b-2 border-transparent text-dimmed hover:text-default transition-colors'
const active = 'text-primary border-primary font-semibold'
</script>

<template>
  <div>
    <!-- faixa colada no navbar, full-bleed (integrada à moldura header+sidebar), sticky no scroll;
         o record da aba só casa nas rotas filhas dela — '/' não fica ativa em /devs -->
    <nav class="sticky top-0 z-10 bg-default border-b border-default" aria-label="abas do dashboard">
      <div class="max-w-[1320px] w-full mx-auto px-5 flex gap-1">
        <RouterLink
          v-for="t in tabs"
          :key="t.to"
          :to="t.to"
          :class="base"
          :active-class="active"
          :exact-active-class="active"
        >
          <UIcon :name="t.icon" class="size-4" />
          {{ t.label }}
        </RouterLink>
      </div>
    </nav>

    <div class="max-w-[1320px] w-full mx-auto px-5 py-6">
      <RouterView />
    </div>
  </div>
</template>
