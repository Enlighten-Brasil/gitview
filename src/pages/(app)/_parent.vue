<script setup lang="ts">
/**
 * Shell do dashboard (rail + painel + navbar) — o guard global garante que
 * nenhuma rota filha monta sem dados carregados (stats.json), e o setup
 * (wizard/settings) renderiza fora daqui.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { collectError, collecting, collectLog, collectStep, collectSucceeded, startCollect } from '@/collect'
import AppNav from '@/components/AppNav.vue'
import CandidatesBanner from '@/components/CandidatesBanner.vue'
import WeeklySummary from '@/components/WeeklySummary.vue'
import { useCollectToasts } from '@/composables/useCollectToasts'
import { rangeLabel, stats } from '@/data'
import { fmtDateTime } from '@/format'
import { loadGithub } from '@/github'
import { loadReleases } from '@/releases'
import { DETAIL_ROUTES } from '@/router/meta'
import { initUrlState } from '@/urlState'

definePage({
  meta: {
    requiresData: true,
  },
})

const route = useRoute()

// feedback de conclusão/erro de qualquer coleta disparada pela UI (navbar,
// manutenção, salvar + recoletar) — o popover/log mostra o progresso
useCollectToasts()

// github/releases são "nice to have" (algumas páginas não usam) — disparam no
// boot mas não bloqueiam navegação; cada seção trata o estado vazio próprio.
onMounted(loadGithub)
onMounted(loadReleases)

// filtros sincronizados com a URL (escopo por route.meta.filters)
initUrlState()

// navbar: título por rota — param nas páginas de detalhe, meta.title nas demais,
// e no dashboard em geral o período atual (DETAIL_ROUTES tipado em router/meta)
const navTitle = computed(() => {
  if (route.name != null && DETAIL_ROUTES.has(route.name))
    return String(route.params.name ?? '')
  if (route.meta.title)
    return route.meta.title
  return rangeLabel.value
})

// coleta pela UI: só em dev (o endpoint /__collect é middleware do Vite)
const isDev = import.meta.env.DEV
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
  if (!stats.value)
    return null
  const hours = (Date.now() - new Date(stats.value.generatedAt).getTime()) / 3_600_000
  const label = hours < 1
    ? 'agora mesmo'
    : hours < 24
      ? `há ${Math.floor(hours)}h`
      : `há ${Math.floor(hours / 24)}d`
  return { label, stale: hours >= 24, generatedAt: stats.value.generatedAt }
})
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppNav />

    <!-- body sem padding: cada view controla seu próprio padding/container
         (dashboard: faixa de abas full-bleed colada no navbar) -->
    <UDashboardPanel :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }" class="flex-1 min-w-0">
      <template #header>
        <UDashboardNavbar :title="navTitle">
          <template #right>
            <UTooltip v-if="dataAge" :text="`dados gerados em ${fmtDateTime(dataAge.generatedAt)}`">
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
        <CandidatesBanner v-if="route.meta.filters === 'full'" />
        <!-- landmark main: o conteúdo da rota (banner fica fora) -->
        <main>
          <RouterView />
        </main>
      </template>
    </UDashboardPanel>
  </div>
</template>
