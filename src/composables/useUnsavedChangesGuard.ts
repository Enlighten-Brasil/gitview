import { onUnmounted } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

const DIRTY_MSG = 'você tem mudanças não salvas no time — sair mesmo assim?'

/**
 * Guarda de saída do editor de times: confirma antes de navegar embora ou fechar
 * a aba com mudanças não salvas. O `window.confirm` é a única confirmação
 * síncrona que um before-hook de rota aceita (UI custom fica pra issue #38).
 */
export function useUnsavedChangesGuard(isDirty: () => boolean) {
  onBeforeRouteLeave(() => {
    if (!isDirty())
      return true
    // eslint-disable-next-line no-alert -- UI custom seria assíncrona e não poderia cancelar a navegação
    return window.confirm(DIRTY_MSG)
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
