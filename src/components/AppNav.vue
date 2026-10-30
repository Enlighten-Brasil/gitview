<script setup lang="ts">
/**
 * Navegação two-pane estilo Sentry:
 * - rail primária (56px, ícones + rótulo minúsculo): seções globais
 * - painel contextual (220px): sub-itens da seção ativa + filtros (quando couber)
 * O painel contextual é recolhível (botão « no header), persistido em localStorage.
 * A seção ativa vem de route.meta.section; sub-itens são rotas ou âncoras.
 * Sub só de âncora (#id) só renderiza se o id existir na rota atual (#200).
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { NAV_BOTTOM, NAV_SECTIONS } from '@/nav'
import { serverMode } from '@/router/guards'
import FilterBar from './FilterBar.vue'

// labels do nav.ts são chaves i18n (catálogo nav.json) — resolve no escopo global
const { t } = useI18n({ useScope: 'global' })
const route = useRoute()
const sectionKey = computed(() => route.meta.section ?? null)
const section = computed(() =>
  [...NAV_SECTIONS, NAV_BOTTOM].find(s => s.key === sectionKey.value) ?? null,
)

// sub-âncoras: só aparecem se o id existir na rota atual (#200) — checagem
// pós-render (o DOM não é reativo); seções lazy nascem depois do render
// inicial, então um MutationObserver reavalia junto com cada mudança de rota
const anchorIds = ref<Set<string>>(new Set())
function refreshAnchors() {
  const next = new Set<string>()
  for (const s of section.value?.subs ?? []) {
    if (s.hash && document.getElementById(s.hash))
      next.add(s.hash)
  }
  if (next.size !== anchorIds.value.size || [...next].some(id => !anchorIds.value.has(id)))
    anchorIds.value = next
}

// item com rota própria sempre renderiza; item só de âncora some junto do id órfão
const visibleSubs = computed(() =>
  (section.value?.subs ?? []).filter(s => s.to || !s.hash || anchorIds.value.has(s.hash)),
)

let anchorObserver: MutationObserver | undefined
let anchorRaf = 0
watch(() => route.fullPath, refreshAnchors, { flush: 'post' })
onMounted(() => {
  refreshAnchors()
  anchorObserver = new MutationObserver(() => {
    cancelAnimationFrame(anchorRaf)
    anchorRaf = requestAnimationFrame(refreshAnchors)
  })
  anchorObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['id'] })
})
onUnmounted(() => {
  anchorObserver?.disconnect()
  cancelAnimationFrame(anchorRaf)
})

// recolher o painel contextual (a rail fica sempre visível)
const CONTEXT_KEY = 'gitview:contextCollapsed'
const contextCollapsed = ref(localStorage.getItem(CONTEXT_KEY) === '1')
watch(contextCollapsed, v => localStorage.setItem(CONTEXT_KEY, v ? '1' : '0'))

// largura do painel contextual — redimensionável por arraste (handle na borda)
// ou teclado (setas), persistida em localStorage
const CONTEXT_W_KEY = 'gitview:contextW'
const CONTEXT_W_MIN = 220
const CONTEXT_W_MAX = 520
function clampContextW(w: number): number {
  return Math.min(CONTEXT_W_MAX, Math.max(CONTEXT_W_MIN, w))
}
const contextW = ref(clampContextW(Number(localStorage.getItem(CONTEXT_W_KEY)) || 280))
watch(contextW, v => localStorage.setItem(CONTEXT_W_KEY, String(v)))

let resizing = false
let resizeStartX = 0
let resizeStartW = 0
function onResizeStart(e: PointerEvent) {
  resizing = true
  resizeStartX = e.clientX
  resizeStartW = contextW.value
  e.currentTarget.setPointerCapture(e.pointerId)
}
function onResizeMove(e: PointerEvent) {
  if (resizing)
    contextW.value = clampContextW(resizeStartW + (e.clientX - resizeStartX))
}
function onResizeEnd(e: PointerEvent) {
  if (!resizing)
    return
  resizing = false
  e.currentTarget.releasePointerCapture(e.pointerId)
}
function nudgeContextW(dx: number) {
  contextW.value = clampContextW(contextW.value + dx)
}

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
  return visibleSubs.value.length > 0 || filtersScope.value !== 'none'
})
</script>

<template>
  <div class="relative flex h-full">
    <!-- rail primária -->
    <nav class="rail" :aria-label="t('nav.aria.sections')">
      <RouterLink to="/" class="rail-logo" :aria-label="t('nav.aria.home')">
        <UIcon name="i-lucide-git-graph" class="size-5" />
      </RouterLink>
      <div class="rail-items">
        <RouterLink
          v-for="s in NAV_SECTIONS"
          :key="s.key"
          :to="s.to"
          class="rail-item"
          :class="{ active: sectionKey === s.key }"
          :aria-label="t(s.label)"
          :aria-current="sectionKey === s.key ? 'page' : undefined"
        >
          <UIcon :name="s.icon" class="size-[18px]" />
          <span class="rail-label">{{ t(s.label) }}</span>
        </RouterLink>
      </div>
      <div v-if="serverMode" class="rail-bottom">
        <RouterLink
          :to="NAV_BOTTOM.to"
          class="rail-item"
          :class="{ active: sectionKey === NAV_BOTTOM.key }"
          :aria-label="t(NAV_BOTTOM.label)"
          :aria-current="sectionKey === NAV_BOTTOM.key ? 'page' : undefined"
        >
          <UIcon :name="NAV_BOTTOM.icon" class="size-[18px]" />
          <span class="rail-label">{{ t(NAV_BOTTOM.label) }}</span>
        </RouterLink>
      </div>
    </nav>

    <!-- painel contextual -->
    <aside v-if="showPanel" class="context" :style="{ width: `${contextW}px` }" :aria-label="t('nav.aria.section')">
      <header class="context-header">
        <h2 class="context-title">
          {{ section ? t(section.label) : '' }}
        </h2>
        <UButton
          icon="i-lucide-chevrons-left"
          color="neutral"
          variant="ghost"
          size="xs"
          :aria-label="t('nav.aria.hidePanel')"
          @click="contextCollapsed = true"
        />
      </header>

      <nav v-if="visibleSubs.length" class="context-nav">
        <RouterLink
          v-for="s in visibleSubs"
          :key="s.label"
          :to="subLink(s)"
          class="context-item"
          :class="{ active: isSubActive(s) }"
        >
          <UIcon v-if="s.icon" :name="s.icon" class="size-4 shrink-0" />
          <span class="truncate">{{ t(s.label) }}</span>
        </RouterLink>
      </nav>

      <template v-if="filtersScope !== 'none'">
        <USeparator v-if="visibleSubs.length" class="my-3" />
        <FilterBar />
      </template>
    </aside>

    <!-- handle de redimensionamento (arraste ou setas) — borda do painel -->
    <div
      v-if="showPanel"
      class="resize-handle"
      role="separator"
      aria-orientation="vertical"
      :aria-label="t('nav.aria.resize')"
      :aria-valuemin="CONTEXT_W_MIN"
      :aria-valuemax="CONTEXT_W_MAX"
      :aria-valuenow="contextW"
      tabindex="0"
      @pointerdown="onResizeStart"
      @pointermove="onResizeMove"
      @pointerup="onResizeEnd"
      @keydown.left.prevent="nudgeContextW(-16)"
      @keydown.right.prevent="nudgeContextW(16)"
    />

    <!-- botão flutuante pra reabrir quando recolhido -->
    <UButton
      v-if="!showPanel && section && (visibleSubs.length > 0 || filtersScope !== 'none')"
      icon="i-lucide-chevrons-right"
      color="neutral"
      variant="soft"
      size="xs"
      class="absolute left-[calc(var(--rail-w)+8px)] top-16 z-10"
      :aria-label="t('nav.aria.showPanel')"
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
  flex-shrink: 0;
  overflow-y: auto;
  padding: 12px;
  border-right: 1px solid var(--ui-border);
  background: var(--ui-bg);
  display: flex;
  flex-direction: column;
}
.resize-handle {
  width: 5px;
  flex-shrink: 0;
  cursor: col-resize;
  touch-action: none;
  background: transparent;
  transition: background .15s;
}
.resize-handle:hover,
.resize-handle:focus-visible {
  background: color-mix(in oklab, var(--ui-primary) 35%, transparent);
  outline: none;
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
}
</style>
