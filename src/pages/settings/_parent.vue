<script setup lang="ts">
/**
 * Tela de Configurações (com dados já coletados) — substitui o wizard.
 * Sub-navegação própria (Geral / Repositórios / Conta); o guard tira o
 * usuário daqui no build estático (endpoints /__* não existem).
 */
definePage({
  meta: {
    requiresData: true,
    requiresServer: true,
    section: 'settings',
    title: 'nav.page.settings',
  },
})

const links = [
  { label: 'Geral', to: '/settings' },
  { label: 'Repositórios', to: '/settings/repos' },
  { label: 'Conta GitHub', to: '/settings/account' },
]
const base = 'inline-flex items-center gap-1.5 py-2.5 px-2 text-sm font-medium border-b-2 border-transparent text-dimmed hover:text-default transition-colors'
const active = 'text-primary border-primary font-semibold'
</script>

<template>
  <div class="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
    <div>
      <h1 class="text-2xl font-bold">
        Configurações
      </h1>
      <p class="text-sm text-dimmed">
        repositórios, coleta e conta do GitHub desta máquina
      </p>
    </div>

    <nav class="border-b border-default flex gap-1" aria-label="configurações">
      <RouterLink
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        :class="base"
        :active-class="active"
      >
        {{ l.label }}
      </RouterLink>
    </nav>

    <RouterView />
  </div>
</template>
