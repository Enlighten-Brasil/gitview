import { onUnmounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useConfirm } from '@/composables/useConfirm'

/**
 * Guarda de saída do editor de times: pergunta antes de navegar embora ou
 * fechar a aba com mudanças não salvas. O hook de rota aceita Promise — a
 * confirmação usa o `useConfirm` (UModal) unificado (issue #38); só o
 * beforeunload continua nativo (o diálogo do navegador é o único que a aba
 * aceita ao fechar).
 */
export function useUnsavedChangesGuard(isDirty: () => boolean) {
  const confirm = useConfirm()

  onBeforeRouteLeave(async () => {
    if (!isDirty())
      return true
    return confirm({
      title: 'Sair sem salvar?',
      description: 'Você tem mudanças não salvas no time — sair agora descarta as alterações.',
      confirmLabel: 'sair mesmo assim',
      cancelLabel: 'continuar editando',
    })
  })

  function onBeforeUnload(e: BeforeUnloadEvent) {
    if (isDirty()) {
      e.preventDefault()
      e.returnValue = ''
    }
  }

  // registrado no setup (SPA sem SSR) — sem onMounted extra, o boot da página
  // tem um único onMounted com a sequência explícita (issue #40)
  window.addEventListener('beforeunload', onBeforeUnload)
  onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))
}
