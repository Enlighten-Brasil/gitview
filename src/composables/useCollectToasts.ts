import { useToast } from '@nuxt/ui/composables'
import { watch } from 'vue'
import { collectError, collectSucceeded } from '@/collect'

/**
 * Toasts da coleta (issue #38 — toda ação com efeito tem feedback): sucesso e
 * erro em qualquer fluxo que dispare `startCollect` (navbar, manutenção,
 * salvar + recoletar, wizard). Registrado pelos shells (app + setup).
 */
export function useCollectToasts() {
  const toast = useToast()

  watch(collectSucceeded, (ok) => {
    if (ok)
      toast.add({ title: 'Coleta concluída', description: 'Dados do dashboard atualizados.', color: 'success' })
  })

  watch(collectError, (err) => {
    if (err)
      toast.add({ title: 'Erro na coleta', description: err, color: 'error' })
  })
}
