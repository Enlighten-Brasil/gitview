/**
 * Infra única dos loaders de `public/data/*.json`: fetch + cache-bust (`?t=`
 * no force), política de cache e tratamento de erro num lugar só. Cada loader
 * do app (stats/commits/github/releases/team) vira um `defineLoader` e mantém
 * via opts a mensagem de erro e o efeito no dado em falha que a UI já conhece.
 */
import type { Ref } from 'vue'
import { ref } from 'vue'

export interface LoaderOptions<T> {
  /** extrai o valor do JSON bruto (default: o JSON inteiro) */
  pick?: (json: unknown) => T
  /** mensagem no ref de erro: fixa ou derivada do erro (default: a mensagem do erro) */
  errorMessage?: string | ((err: Error) => string)
  /** mensagem do erro HTTP não-OK (default: `HTTP ${status}`) */
  httpError?: (status: number) => string
  /** valor do dado quando o load falha (default: preserva o valor atual) */
  onErrorValue?: T | null
}

export interface Loader<T> {
  data: Ref<T | null>
  error: Ref<string | null>
  load: (force?: boolean) => Promise<void>
}

export function defineLoader<T>(path: string, opts: LoaderOptions<T> = {}): Loader<T> {
  const data = ref(null) as Ref<T | null>
  const error = ref<string | null>(null)

  async function load(force = false) {
    // política de cache unificada: já carregado e sem force → não refaz o fetch
    if (data.value && !force)
      return
    try {
      const url = `${import.meta.env.BASE_URL}data/${path}`
      const res = await fetch(force ? `${url}?t=${Date.now()}` : url)
      if (!res.ok)
        throw new Error(opts.httpError ? opts.httpError(res.status) : `HTTP ${res.status}`)
      data.value = (opts.pick ?? ((json: unknown) => json as T))(await res.json())
      error.value = null
    }
    catch (err) {
      const e = err as Error
      // onErrorValue define o dado em falha; sem ele, o valor atual é preservado
      if (opts.onErrorValue !== undefined)
        data.value = opts.onErrorValue
      error.value = typeof opts.errorMessage === 'function'
        ? opts.errorMessage(e)
        : opts.errorMessage ?? String(e.message ?? e)
    }
  }

  return { data, error, load }
}
