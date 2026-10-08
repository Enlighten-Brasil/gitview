<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { loadStats, rangeLabel, stats } from './data'
import { loadGithub } from './github'
import { initUrlState } from './urlState'
import { version } from '../package.json'
import FilterBar from './components/FilterBar.vue'

onMounted(loadStats)
onMounted(loadGithub)

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
            rode <code class="bg-accented px-1 py-0.5 rounded">pnpm collect</code> para atualizar
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
          </UDashboardNavbar>
        </template>

        <template #body>
          <RouterView />
        </template>
      </UDashboardPanel>
    </UDashboardGroup>
  </UApp>
</template>
