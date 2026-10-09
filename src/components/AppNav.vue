<script setup lang="ts">
/**
 * Navegação two-pane estilo Sentry:
 * - rail primária (56px, ícones + rótulo minúsculo): seções globais
 * - painel contextual (220px): sub-itens da seção ativa + filtros (quando couber)
 * O painel contextual é recolhível (botão « no header), persistido em localStorage.
 * A seção ativa vem de route.meta.section; sub-itens são rotas ou âncoras.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { NAV_BOTTOM, NAV_SECTIONS } from '@/nav'
import { serverMode } from '@/router/guards'
import FilterBar from './FilterBar.vue'

const route = useRoute()
const sectionKey = computed(() => route.meta.section ?? null)
const section = computed(() =>
  [...NAV_SECTIONS, NAV_BOTTOM].find(s => s.key === sectionKey.value) ?? null,
)

// recolher o painel contextual (a rail fica sempre visível)
const CONTEXT_KEY = 'gitview:contextCollapsed'
const contextCollapsed = ref(localStorage.getItem(CONTEXT_KEY) === '1')
watch(contextCollapsed, v => localStorage.setItem(CONTEXT_KEY, v ? '1' : '0'))

function subLink(s: { to?: string, hash?: string }) {
  if (s.to)
    return { path: s.to }
  return { path: route.path, hash: s.hash ? `#${s.hash}` : undefined }
}

function isSubActive(s: { to?: string, hash?: string }): boolean {
  if (s.hash)
    return route.hash === `#${s.hash}`
  if (!s.to)
    return false
  // exato, ou pai do detalhe (/devs ativo em /devs/Ana; '/' só casa exato)
  if (s.to === '/')
    return route.path === '/'
  return route.path === s.to || route.path.startsWith(`${s.to}/`)
}

const filtersScope = computed(() => route.meta.filters ?? 'none')
const showPanel = computed(() => {
  if (contextCollapsed.value)
    return false
  const s = section.value
  if (!s)
    return false
  return s.subs.length > 0 || filtersScope.value !== 'none'
})
</script>

<template>
  <div class="flex h-full">
    <!-- rail primária -->
    <nav class="rail" aria-label="seções">
      <RouterLink to="/" class="rail-logo" aria-label="gitview — início">
        <UIcon name="i-lucide-git-graph" class="size-5" />
      </RouterLink>
      <div class="rail-items">
        <RouterLink
          v-for="s in NAV_SECTIONS"
          :key="s.key"
          :to="s.to"
          class="rail-item"
          :class="{ active: sectionKey === s.key }"
          :aria-current="sectionKey === s.key ? 'page' : undefined"
        >
          <UIcon :name="s.icon" class="size-[18px]" />
          <span class="rail-label">{{ s.label }}</span>
        </RouterLink>
      </div>
      <div v-if="serverMode" class="rail-bottom">
        <RouterLink
          :to="NAV_BOTTOM.to"
          class="rail-item"
          :class="{ active: sectionKey === NAV_BOTTOM.key }"
          :aria-current="sectionKey === NAV_BOTTOM.key ? 'page' : undefined"
        >
          <UIcon :name="NAV_BOTTOM.icon" class="size-[18px]" />
          <span class="rail-label">{{ NAV_BOTTOM.label }}</span>
        </RouterLink>
      </div>
    </nav>

    <!-- painel contextual -->
    <aside v-if="showPanel" class="context" aria-label="navegação da seção">
      <header class="context-header">
        <h2 class="context-title">
          {{ section?.label }}
        </h2>
        <UButton
          icon="i-lucide-chevrons-left"
          color="neutral"
          variant="ghost"
          size="xs"
          aria-label="ocultar painel"
          @click="contextCollapsed = true"
        />
      </header>

      <nav v-if="section?.subs.length" class="context-nav">
        <RouterLink
          v-for="s in section.subs"
          :key="s.label"
          :to="subLink(s)"
          class="context-item"
          :class="{ active: isSubActive(s) }"
        >
          <UIcon v-if="s.icon" :name="s.icon" class="size-4 shrink-0" />
          <span class="truncate">{{ s.label }}</span>
        </RouterLink>
      </nav>

      <template v-if="filtersScope !== 'none'">
        <USeparator v-if="section?.subs.length" class="my-3" />
        <FilterBar />
      </template>
    </aside>

    <!-- botão flutuante pra reabrir quando recolhido -->
    <UButton
      v-else-if="section && (section.subs.length > 0 || filtersScope !== 'none')"
      icon="i-lucide-chevrons-right"
      color="neutral"
      variant="soft"
      size="xs"
      class="absolute left-[calc(var(--rail-w)+8px)] top-16 z-10"
      aria-label="mostrar painel"
      @click="contextCollapsed = false"
    />
  </div>
</template>

<style scoped>
.rail {
  width: var(--rail-w, 64px);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 2px;
  padding: 8px 6px;
  border-right: 1px solid var(--ui-border);
  background: var(--ui-bg-muted);
}
.rail-logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  margin-bottom: 4px;
  color: var(--ui-primary);
}
.rail-items { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.rail-bottom { margin-top: auto; }
.rail-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 2px 6px;
  border-radius: 8px;
  color: var(--ui-text-muted);
  transition: color .15s, background .15s;
}
.rail-item:hover { color: var(--ui-text); background: var(--ui-bg-elevated); }
.rail-item.active { color: var(--ui-text); }
.rail-item.active::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 8px;
  bottom: 8px;
  width: 3px;
  border-radius: 2px;
  background: var(--ui-primary);
}
.rail-item.active .rail-label { font-weight: 600; }
.rail-label {
  font-size: 10px;
  line-height: 1;
  letter-spacing: .01em;
  white-space: nowrap;
}

.context {
  width: var(--context-w, 232px);
  flex-shrink: 0;
  overflow-y: auto;
  padding: 12px;
  border-right: 1px solid var(--ui-border);
  background: var(--ui-bg);
  display: flex;
  flex-direction: column;
}
.context-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.context-title {
  font-size: 13px;
  font-weight: 600;
}
.context-nav { display: flex; flex-direction: column; gap: 1px; }
.context-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--ui-text-muted);
  transition: color .15s, background .15s;
}
.context-item:hover { color: var(--ui-text); background: var(--ui-bg-elevated); }
.context-item.active {
  color: var(--ui-primary);
  background: color-mix(in oklab, var(--ui-primary) 12%, transparent);
  font-weight: 600;
}

@media (max-width: 640px) {
  .rail-label { display: none; }
  .rail { width: 48px; }
  .context { width: 200px; }
}
</style>
