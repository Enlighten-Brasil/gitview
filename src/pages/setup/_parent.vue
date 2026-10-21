<script setup lang="ts">
/**
 * Layout do wizard de primeira execução (sem dados). Renderiza fora do shell
 * do dashboard — sem rail/navbar — para a pessoa não conseguir "sair" do
 * setup por rotas de dados (o guard também barra). Em build estático os
 * endpoints /__* não existem: o diagnóstico substitui o wizard e aponta a
 * saída para a documentação do projeto.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useCollectToasts } from '@/composables/useCollectToasts'
import { stats } from '@/data'
import { serverMode } from '@/router/guards'
import { repository } from '../../../package.json'

definePage({
  meta: {
    onboarding: true,
  },
})

// feedback de conclusão/erro da coleta do passo 3 (o RunLog mostra o progresso)
useCollectToasts()

// link de saída do beco sem saída: a URL do PRÓPRIO repo, já versionada no
// package.json (self-referencial) — nunca links de repos/times analisados
const projectUrl = repository.url.replace(/^git\+/, '').replace(/\.git$/, '')

const route = useRoute()
const STEPS: Record<string, { n: number, label: string, optional?: boolean }> = {
  '/setup/github': { n: 1, label: 'conectar o GitHub' },
  '/setup/repos': { n: 2, label: 'escolher repositórios' },
  '/setup/collect': { n: 3, label: 'clonar e coletar' },
  '/setup/team': { n: 4, label: 'definir o time', optional: true },
}
const step = computed(() => STEPS[String(route.name)] ?? null)
// sem dados no dist a explicação diz o que falta; com dados (só /setup/team
// alcança esta tela) o dashboard é somente leitura
const hasData = computed(() => stats.value != null)
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-8">
    <div>
      <h1 class="text-2xl font-bold">
        Configurar gitview
      </h1>
      <p v-if="step" class="text-sm text-dimmed">
        passo {{ step.n }} de {{ step.optional ? 4 : 3 }}{{ step.optional ? ' (opcional)' : '' }} — {{ step.label }}
      </p>
    </div>

    <UAlert
      v-if="!serverMode"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Setup disponível apenas em modo dev"
    >
      <template #description>
        <template v-if="!hasData">
          Você abriu o build estático sem dados coletados: sem o <code>public/data/stats.json</code> não há dashboard para mostrar e o wizard não roda aqui — os endpoints de configuração só existem no dev server (<code>pnpm dev</code> / <code>pnpm start</code>). Rode a coleta localmente e publique o <code>dist/</code> com os JSONs prontos.
        </template>
        <template v-else>
          Os endpoints de configuração só existem no dev server (<code>pnpm dev</code> / <code>pnpm start</code>). No build estático o dashboard é somente leitura — rode a coleta por lá e publique o <code>dist/</code> com os JSONs prontos.
        </template>
        <br>Documentação do projeto (manual, guia de configuração e release):
        <ULink :href="projectUrl" target="_blank" rel="noopener" class="font-medium underline">
          {{ projectUrl }}
        </ULink>
      </template>
    </UAlert>
    <RouterView v-else />
  </div>
</template>
