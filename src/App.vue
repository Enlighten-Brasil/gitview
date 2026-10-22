<script setup lang="ts">
import { useToast } from '@nuxt/ui/composables'
import { onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { loadStats, stats, statsNetworkError, statsServerError } from '@/data'

const { t } = useI18n({ useScope: 'global' })

// App raiz só casaroteia: UApp (toasts/popovers do Nuxt UI) + a rota ativa.
// O shell do dashboard (rail/navbar) é pages/(app)/_parent.vue; o do setup tem
// layout próprio — o guard (src/router/guards.ts) decide quem entra onde.
const router = useRouter()
const ready = ref(false)

// falha no loadStats COM feedback (rede ou HTTP >= 500 = servidor com erro) ≠
// 404/HTML (sem arquivo → wizard em silêncio): toast com retry em vez de vazio
// (issue #195, estendido na #237). Toast fixo (duration 0) porque a falha pode
// persistir; o retry refaz o load e só sai do wizard se vier dado.
const toast = useToast()
// toast.add devolve o OBJETO do toast; remove(id) casa por t.id — guardar o id
let loadToastId: string | undefined

async function retryStats() {
  await loadStats(true)
  // navega pelo resultado FRESCO do retry (não por stats velho): falha ainda
  // presente deixa o watcher trocar o toast; sucesso o remove e sai do wizard
  if (statsNetworkError.value || statsServerError.value)
    return
  if (loadToastId !== undefined) {
    toast.remove(loadToastId)
    loadToastId = undefined
  }
  if (stats.value != null && router.currentRoute.value.meta.onboarding)
    void router.push('/')
}

watch([statsNetworkError, statsServerError], ([net, server]) => {
  if (!net && !server)
    return
  // remove-antes-de-adicionar: um toast por vez — troca a mensagem quando o
  // tipo de falha muda e REABRE após fechamento manual (a nova falha remove o
  // id retido em vez de ser suprimida por ele)
  if (loadToastId !== undefined) {
    toast.remove(loadToastId)
    loadToastId = undefined
  }
  const retryAction = { label: 'Tentar de novo', onClick: retryStats }
  loadToastId = toast.add(server
    ? {
        title: 'Erro no servidor dos dados',
        description: 'O servidor dos dados respondeu com erro — o que está na tela pode estar desatualizado.',
        color: 'error',
        icon: 'i-lucide-triangle-alert',
        duration: 0,
        actions: [retryAction],
      }
    : {
        title: 'Falha de rede ao carregar os dados',
        description: 'Sem conexão com o servidor dos dados — o que está na tela pode estar desatualizado.',
        color: 'error',
        icon: 'i-lucide-wifi-off',
        duration: 0,
        actions: [retryAction],
      }).id
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
      <span class="sr-only">{{ t('app.loading') }}</span>
    </div>
    <RouterView v-else />
    <!-- confirmação destrutiva unificada (useConfirm) — vive fora das rotas -->
    <ConfirmDialog />
  </UApp>
</template>
