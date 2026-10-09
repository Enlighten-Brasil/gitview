<script setup lang="ts">
/**
 * Layout do wizard de primeira execução (sem dados). Renderiza fora do shell
 * do dashboard — sem rail/navbar — para a pessoa não conseguir "sair" do
 * setup por rotas de dados (o guard também barra). Em build estático os
 * endpoints /__* não existem: o aviso substitui o wizard.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { serverMode } from '@/router/guards'

definePage({
  meta: {
    onboarding: true,
  },
})

const route = useRoute()
const STEPS: Record<string, { n: number, label: string }> = {
  '/setup/github': { n: 1, label: 'conectar o GitHub' },
  '/setup/repos': { n: 2, label: 'escolher repositórios' },
  '/setup/collect': { n: 3, label: 'clonar e coletar' },
}
const step = computed(() => STEPS[String(route.name)] ?? null)
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-8">
    <div>
      <h1 class="text-2xl font-bold">
        Configurar gitview
      </h1>
      <p v-if="step" class="text-sm text-dimmed">
        passo {{ step.n }} de 3 — {{ step.label }}
      </p>
    </div>

    <UAlert
      v-if="!serverMode"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Setup disponível apenas em modo dev"
      description="Os endpoints de configuração só existem no dev server (pnpm dev / pnpm start). No build estático o dashboard é somente leitura — rode a coleta por lá e publique o dist/ com os JSONs prontos."
    />
    <RouterView v-else />
  </div>
</template>
