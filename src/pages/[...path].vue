<script setup lang="ts">
/**
 * 404 — qualquer caminho fora do mapa de rotas.
 */
import { useI18n } from 'vue-i18n'

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-8">
    <UCard class="max-w-md w-full text-center">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-lucide-compass" class="size-10 text-dimmed" />
        <h1 class="text-xl font-semibold">
          {{ t('app.notFound.title') }}
        </h1>
        <p class="text-sm text-dimmed">
          {{ t('app.notFound.description') }}
        </p>
        <UButton :label="t('app.notFound.back')" to="/" class="mt-2" />
      </div>
    </UCard>
  </div>
</template>
