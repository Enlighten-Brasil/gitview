<script setup lang="ts">
/**
 * Barra sticky de gravação do editor de times: estado dirty, desfazer (revert ao
 * snapshot salvo), salvar e salvar + recoleta leve. Ações saem por emits — quem
 * persiste é o composable na página (issue #40).
 */
defineProps<{
  dirty: boolean
  saving: boolean
  /** recoleta leve em andamento (startCollect) */
  collecting: boolean
}>()

const emit = defineEmits<{
  'revert': []
  'save': []
  'save-and-recollect': []
}>()
</script>

<template>
  <div
    class="sticky bottom-0 z-10 mt-2 flex items-center gap-2 rounded-xl border border-default bg-default/85 dark:bg-elevated/85 backdrop-blur px-3 py-2 shadow-lg"
  >
    <UIcon
      :name="dirty ? 'i-lucide-circle-dot' : 'i-lucide-circle-check'"
      class="size-4 shrink-0"
      :class="dirty ? 'text-warning' : 'text-success'"
    />
    <span class="text-xs text-dimmed">
      {{ dirty ? 'alterações não salvas (só nesta máquina até salvar)' : 'tudo salvo em team.local.json' }}
    </span>
    <div class="ml-auto flex items-center gap-2">
      <UButton
        v-if="dirty"
        label="desfazer"
        size="xs"
        color="neutral"
        variant="ghost"
        :disabled="saving || collecting"
        @click="emit('revert')"
      />
      <UButton
        icon="i-lucide-save"
        size="xs"
        :loading="saving"
        :disabled="!dirty"
        label="salvar"
        @click="emit('save')"
      />
      <UTooltip text="salva e roda a recoleta leve (re-agrega os dados com os novos aliases, sem re-escanear o git)">
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="soft"
          size="xs"
          :loading="collecting"
          label="salvar + recoletar"
          @click="emit('save-and-recollect')"
        />
      </UTooltip>
    </div>
  </div>
</template>
