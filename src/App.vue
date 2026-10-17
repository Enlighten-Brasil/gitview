<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'

// App raiz só casaroteia: UApp (toasts/popovers do Nuxt UI) + a rota ativa.
// O shell do dashboard (rail/navbar) é pages/(app)/_parent.vue; o do setup tem
// layout próprio — o guard (src/router/guards.ts) decide quem entra onde.
const router = useRouter()
const ready = ref(false)

onMounted(() => {
  router.isReady().then(() => {
    ready.value = true
  })
})
</script>

<template>
  <UApp>
    <!-- splash enquanto o guard do boot espera o stats.json (1ª navegação) -->
    <div v-if="!ready" class="flex h-screen items-center justify-center bg-muted" role="status">
      <UIcon name="i-lucide-git-graph" class="size-8 animate-pulse text-primary" />
      <span class="sr-only">carregando…</span>
    </div>
    <RouterView v-else />
    <!-- confirmação destrutiva unificada (useConfirm) — vive fora das rotas -->
    <ConfirmDialog />
  </UApp>
</template>
