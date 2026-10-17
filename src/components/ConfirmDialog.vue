<script setup lang="ts">
/**
 * Diálogo de confirmação destrutiva do useConfirm (issue #38) — um UModal
 * único pro app inteiro, montado no App.vue. Fechar (ESC/clique fora) conta
 * como cancelar; a Promise nunca fica pendurada.
 */
import { confirmRequest, settleConfirm } from '@/composables/useConfirm'

function onOpenChange(open: boolean) {
  if (!open)
    settleConfirm(false)
}
</script>

<template>
  <UModal
    :open="confirmRequest.open"
    :title="confirmRequest.title"
    :description="confirmRequest.description"
    @update:open="onOpenChange"
  >
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton
          :label="confirmRequest.cancelLabel ?? 'cancelar'"
          color="neutral"
          variant="ghost"
          @click="settleConfirm(false)"
        />
        <UButton
          :label="confirmRequest.confirmLabel ?? 'confirmar'"
          :color="confirmRequest.color ?? 'error'"
          @click="settleConfirm(true)"
        />
      </div>
    </template>
  </UModal>
</template>
