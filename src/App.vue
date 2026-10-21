<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { loadStats, stats, statsNetworkError } from '@/data'

// App raiz só casaroteia: UApp (toasts/popovers do Nuxt UI) + a rota ativa.
// O shell do dashboard (rail/navbar) é pages/(app)/_parent.vue; o do setup tem
// layout próprio — o guard (src/router/guards.ts) decide quem entra onde.
const router = useRouter()
const ready = ref(false)

// erro de REDE no loadStats ≠ 404 (sem arquivo → wizard): aqui há feedback com
// retry em vez de silêncio (issue #195). Toast fixo (duration 0) porque a rede
// pode continuar fora; o retry refaz o load e só sai do wizard se vier dado.
const toast = useToast()
let netToastId: ReturnType<typeof toast.add> | undefined
watch(statsNetworkError, (net) => {
  if (!net)
    return
  // um toast por falha: o watcher re-dispara a cada tentativa — não duplicar
  if (netToastId !== undefined)
    return
  netToastId = toast.add({
    title: 'Falha de rede ao carregar os dados',
    description: 'Sem conexão com o servidor dos dados — o que está na tela pode estar desatualizado.',
    color: 'error',
    icon: 'i-lucide-wifi-off',
    duration: 0,
    actions: [{
      label: 'Tentar de novo',
      onClick: async () => {
        await loadStats(true)
        // navega pelo resultado FRESCO do retry (não por stats velho): rede
        // ainda fora mantém o toast; sucesso o remove e sai do wizard
        if (statsNetworkError.value)
          return
        if (netToastId !== undefined) {
          toast.remove(netToastId)
          netToastId = undefined
        }
        if (stats.value != null && router.currentRoute.value.meta.onboarding)
          void router.push('/')
      },
    }],
  })
})

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
