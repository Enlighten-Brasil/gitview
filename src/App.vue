<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { collectError, collecting, collectLog, collectStep, collectSucceeded, startCollect } from './collect'
import { loadStats, rangeLabel, stats } from './data'
import { loadGithub } from './github'
import { loadReleases } from './releases'
import { initUrlState } from './urlState'
import { version } from '../package.json'
import FilterBar from './components/FilterBar.vue'

onMounted(loadStats)
onMounted(loadGithub)
onMounted(loadReleases)

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR')
}

// navbar: nome do dev na rota de perfil, período no dashboard
const route = useRoute()
const navTitle = computed(() =>
  route.name === 'dev' ? String(route.params.name ?? '') : rangeLabel.value,
)

// desktop: botão no navbar recolhe a sidebar com 1 clique
// (o UDashboardSidebarCollapse nativo só cobre mobile; no desktop o default é arrastar a borda)
const sidebarCollapsed = ref(false)

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

// aba + filtros sincronizados com a URL (só na rota do dashboard)
initUrlState()
</script>

<template>
  <UApp>
    <UDashboardGroup storage="localStorage" storage-key="gitview">
      <UDashboardSidebar v-model:collapsed="sidebarCollapsed" collapsible resizable>
        <template #header="{ collapsed }">
          <div v-if="!collapsed" class="flex items-center gap-2.5">
            <UIcon name="i-lucide-git-graph" class="size-5 text-primary shrink-0" />
            <span class="app-title" style="font-size: 20px">gitview</span>
            <UBadge color="primary" variant="soft" size="sm">
              v{{ version }}
            </UBadge>
          </div>
          <UIcon v-else name="i-lucide-git-graph" class="size-5 text-primary mx-auto" />
        </template>

        <template #default="{ collapsed, collapse }">
          <div v-if="collapsed" class="flex flex-col items-center pt-1">
            <UTooltip text="mostrar filtros">
              <UButton
                icon="i-lucide-sliders-horizontal"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="collapse(false)"
              />
            </UTooltip>
          </div>
          <FilterBar v-else />
        </template>

        <template #footer="{ collapsed }">
          <p v-if="!collapsed && stats" class="text-xs text-dimmed leading-relaxed">
            gerado em {{ fmtDate(stats.generatedAt) }}<br>
            <template v-if="isDev">
              atualize pelo botão <UIcon name="i-lucide-refresh-cw" class="inline size-3 align-text-top" /> no topo
            </template>
            <template v-else>
              rode <code class="bg-accented px-1 py-0.5 rounded">pnpm collect</code> para atualizar
            </template>
          </p>
        </template>
      </UDashboardSidebar>

      <!-- body sem padding: cada view controla seu próprio padding/container
           (dashboard: faixa de abas full-bleed colada no navbar) -->
      <UDashboardPanel :ui="{ body: 'p-0 sm:p-0 gap-0 sm:gap-0' }">
        <template #header>
          <UDashboardNavbar :title="navTitle">
            <template #leading>
              <UDashboardSidebarCollapse class="lg:hidden" />
              <UButton
                :icon="sidebarCollapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-left-close'"
                color="neutral"
                variant="ghost"
                class="hidden lg:inline-flex"
                :aria-label="sidebarCollapsed ? 'mostrar filtros' : 'ocultar filtros'"
                @click="sidebarCollapsed = !sidebarCollapsed"
              />
            </template>
            <template #right>
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
    </UDashboardGroup>
  </UApp>
</template>
