<script setup lang="ts">
/**
 * Progresso de clone+coleta (passo 3 do wizard e "aplicar mudanças" nas
 * config): header de fase, log completo em <details> e erros. Os botões de
 * ação ficam no slot #actions do chamador.
 */
import { computed } from 'vue'
import { collectError, collecting, collectLog } from '@/collect'
import { setupApplying, setupError, setupLog } from '@/setup'

const props = defineProps<{
  done?: boolean
  /** título quando parado/erro (fases em andamento têm título fixo) */
  idleTitle?: string
}>()

const running = computed(() => setupApplying.value || collecting.value)
const runPhase = computed<'clone' | 'collect' | 'done' | 'error' | 'idle'>(() => {
  if (props.done)
    return 'done'
  if (setupError.value || collectError.value)
    return 'error'
  if (setupApplying.value)
    return 'clone'
  if (collecting.value)
    return 'collect'
  return 'idle'
})
const runTitle = computed(() => {
  switch (runPhase.value) {
    case 'clone': return 'Clonando repositórios…'
    case 'collect': return 'Coletando dados…'
    case 'done': return 'Tudo pronto!'
    case 'error': return 'Algo deu errado'
    default: return props.idleTitle ?? 'Executando…'
  }
})
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2 font-medium" role="status" aria-live="polite">
        <UIcon
          :name="runPhase === 'done' ? 'i-lucide-circle-check' : runPhase === 'error' ? 'i-lucide-circle-x' : running ? 'i-lucide-loader-circle' : 'i-lucide-package-open'"
          :class="[running && 'animate-spin', runPhase === 'done' && 'text-success', runPhase === 'error' && 'text-error']"
          class="size-5"
        />
        {{ runTitle }}
      </div>

      <details v-if="setupLog.length || collectLog.length" class="rounded-lg border border-default" :open="runPhase === 'error'">
        <summary class="cursor-pointer px-3 py-2 text-xs text-dimmed select-none">
          detalhes da execução
        </summary>
        <pre class="max-h-64 overflow-auto px-3 pb-3 font-mono text-xs leading-relaxed whitespace-pre-wrap" role="status" aria-live="polite">{{ [...setupLog, ...collectLog].join('\n') }}</pre>
      </details>

      <UAlert v-if="setupError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="setupError" />
      <UAlert v-else-if="collectError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="collectError" />

      <div class="flex justify-between">
        <slot name="actions" />
      </div>
    </div>
  </UCard>
</template>
