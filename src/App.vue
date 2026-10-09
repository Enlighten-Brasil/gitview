<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { collectError, collecting, collectLog, collectStep, collectSucceeded, startCollect } from './collect'
import { loadError, loadStats, rangeLabel, stats } from './data'
import { loadGithub } from './github'
import { loadReleases } from './releases'
import { initUrlState } from './urlState'
import AppNav from './components/AppNav.vue'
import WeeklySummary from './components/WeeklySummary.vue'

onMounted(loadStats)
onMounted(loadGithub)
onMounted(loadReleases)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR')
}

// navbar: nome do dev na rota de perfil, período no dashboard
const route = useRoute()
const router = useRouter()

/** título do navbar por contexto; em rotas de dados mostra o range atual */
const ROUTE_TITLES: Record<string, string> = {
  team: 'Times',
  setup: 'Configurações',
  releases: 'Releases',
  prs: 'Pull requests',
  repos: 'Repositórios',
}
const navTitle = computed(() => {
  if (route.name === 'dev')
    return String(route.params.name ?? '')
  if (route.name === 'repo')
    return String(route.params.name ?? '')
  return ROUTE_TITLES[route.name as string] ?? rangeLabel.value
})

// coleta pela UI: só em dev (o endpoint /__collect é middleware do Vite)
const isDev = import.meta.env.DEV

// primeira execução sem dados → onboarding (só em dev: no build estático os
// endpoints de setup não existem e o aviso do rodapé já orienta o collect)
watch(loadError, (err) => {
  if (err && isDev && route.name !== 'setup') router.push('/setup')
})
const collectOpen = ref(false)
const logEl = ref<HTMLElement | null>(null)

function onCollectClick(full = false) {
  collectOpen.value = true
  startCollect(full)
}

// autoscroll do log de progresso
watch(() => collectLog.value.length, async () => {
  await nextTick()
  logEl.value?.scrollTo({ top: logEl.value.scrollHeight })
})

// frescor dos dados no navbar — uso manual antes de reuniões, destacar dados velhos
const dataAge = computed(() => {
  if (!stats.value) return null
  const hours = (Date.now() - new Date(stats.value.generatedAt).getTime()) / 3_600_000
  const label = hours < 1
    ? 'agora mesmo'
    : hours < 24
      ? `há ${Math.floor(hours)}h`
      : `há ${Math.floor(hours / 24)}d`
  return { label, stale: hours >= 24, generatedAt: stats.value.generatedAt }
})

// aba + filtros sincronizados com a URL (só na rota do dashboard)
initUrlState()
</script>

<template>
  <UApp>
    <div class="flex h-screen overflow-hidden">
      <AppNav />

      <!-- body sem padding: cada view controla seu próprio padding/container
           (dashboard: faixa de abas full-bleed colada no navbar) -->
      <UDashboardPanel :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }" class="flex-1 min-w-0">
        <template #header>
          <UDashboardNavbar :title="navTitle">
            <template #right>
              <UTooltip v-if="dataAge" :text="`dados gerados em ${fmtDate(dataAge.generatedAt)}`">
                <span
                  class="hidden sm:inline-flex items-center gap-1 text-xs"
                  :class="dataAge.stale ? 'text-warning' : 'text-dimmed'"
                >
                  <UIcon :name="dataAge.stale ? 'i-lucide-triangle-alert' : 'i-lucide-clock'" class="size-3.5" />
                  {{ dataAge.label }}
                </span>
              </UTooltip>
              <WeeklySummary v-if="stats" />
              <UPopover v-if="isDev" v-model:open="collectOpen" :ui="{ content: 'w-96' }">
                <UTooltip text="atualizar dados (git + GitHub)">
                  <UButton
                    icon="i-lucide-refresh-cw"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    :loading="collecting"
                    aria-label="atualizar dados"
                    @click="onCollectClick()"
                  />
                </UTooltip>
                <template #content>
                  <div class="p-3 flex flex-col gap-2">
                    <div class="flex items-center gap-2 text-sm font-medium">
                      <UIcon
                        :name="collectError ? 'i-lucide-circle-x' : collecting ? 'i-lucide-loader-circle' : collectSucceeded ? 'i-lucide-circle-check' : 'i-lucide-refresh-cw'"
                        :class="[collecting && 'animate-spin', collectError ? 'text-error' : collectSucceeded && !collecting ? 'text-success' : 'text-primary']"
                      />
                      <span v-if="collectError">erro na coleta</span>
                      <span v-else-if="collecting">coletando {{ collectStep ?? '' }}…</span>
                      <span v-else-if="collectSucceeded">dados atualizados</span>
                      <span v-else>atualizar dados</span>
                    </div>
                    <pre
                      v-if="collectLog.length"
                      ref="logEl"
                      class="max-h-64 overflow-auto rounded bg-accented p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap"
                    >{{ collectLog.join('\n') }}</pre>
                    <p v-if="collectError" class="text-xs text-error">
                      {{ collectError }}
                    </p>
                    <div v-if="!collecting" class="flex justify-end">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="link"
                        label="coleta completa (--full)"
                        @click="onCollectClick(true)"
                      />
                    </div>
                  </div>
                </template>
              </UPopover>
            </template>
          </UDashboardNavbar>
        </template>

        <template #body>
          <RouterView />
        </template>
      </UDashboardPanel>
    </div>
  </UApp>
</template>
