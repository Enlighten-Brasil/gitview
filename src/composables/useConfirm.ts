import { reactive } from 'vue'

/**
 * Confirmação destrutiva unificada (issue #38): `useConfirm()` devolve uma
 * função que abre o UModal do `ConfirmDialog.vue` e resolve uma Promise em
 * confirmar (true) / cancelar (false). É o ÚNICO padrão de confirmação do
 * app — o `window.confirm` e os swaps inline (botão vira "remover?") foram
 * aposentados. Um diálogo por vez: abrir outro cancela o anterior.
 */
export interface ConfirmOptions {
  /** pergunta direta — inicial maiúscula, ação explícita ("Descartar alterações?") */
  title: string
  /** consequência da ação (o que acontece se confirmar) */
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** cor do botão de confirmação — 'error' (default) pra ação destrutiva */
  color?: 'error' | 'primary' | 'neutral'
}

interface ConfirmRequest extends ConfirmOptions {
  open: boolean
  resolve?: (value: boolean) => void
}

// estado único do diálogo (singleton — o ConfirmDialog renderiza fora das rotas)
const request = reactive<ConfirmRequest>({ open: false, title: '' })

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  return (options) => {
    // pedido anterior ainda aberto: responde como cancelar (nunca pendura Promise)
    settleConfirm(false)
    return new Promise((resolve) => {
      Object.assign(request, options, { open: true, resolve })
    })
  }
}

/** resolve o pedido atual (chamado pelo ConfirmDialog) — idempotente */
export function settleConfirm(value: boolean) {
  request.open = false
  const resolve = request.resolve
  request.resolve = undefined
  resolve?.(value)
}

export const confirmRequest = request
