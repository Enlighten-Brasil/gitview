<script setup lang="ts">
/**
 * 404 — qualquer caminho fora do mapa de rotas.
 */
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-8">
    <UCard class="max-w-md w-full text-center">
      <div class="flex flex-col items-center gap-3">
        <UIcon name="i-lucide-compass" class="size-10 text-dimmed" />
        <h1 class="text-xl font-semibold">
          Página não encontrada
        </h1>
        <p class="text-sm text-dimmed">
          Esse caminho não existe no gitview.
        </p>
        <UButton label="voltar ao início" to="/" class="mt-2" />
      </div>
    </UCard>
  </div>
</template>
