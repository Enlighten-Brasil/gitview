/**
 * Infra única dos loaders de `public/data/*.json`: fetch + cache-bust (`?t=`
 * no force), política de cache e tratamento de erro num lugar só. Cada loader
 * do app (stats/commits/github/releases/team) vira um `defineLoader` e mantém
 * via opts a mensagem de erro e o efeito no dado em falha que a UI já conhece.
 *
 * Payloads em `shallowRef` + `markRaw` (issue #39): o load substitui o objeto
 * inteiro, então reatividade profunda só gastaria CPU convertendo milhares de
 * objetos dos JSONs em proxies a cada fetch.
 */
import type { ShallowRef } from 'vue'
import { markRaw, shallowRef } from 'vue'

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
  /** payload do JSON — shallow: trocado por inteiro a cada load */
  data: ShallowRef<T | null>
  error: ShallowRef<string | null>
  /** falha de REDE do último load (fetch interrompido) ≠ arquivo ausente/HTTP */
  networkError: ShallowRef<boolean>
  /** HTTP não-OK >= 500 no último load (servidor dos dados com erro) ≠ rede/sem-arquivo */
  serverError: ShallowRef<boolean>
  load: (force?: boolean) => Promise<void>
}

/** markRaw num objeto: o payload é imutável pro app, só substituído no load */
function markRawPayload<T>(value: T): T {
  return value !== null && typeof value === 'object' ? markRaw(value as T & object) : value
}

export function defineLoader<T>(path: string, opts: LoaderOptions<T> = {}): Loader<T> {
  const data = shallowRef(null) as ShallowRef<T | null>
  const error = shallowRef<string | null>(null)
  const networkError = shallowRef(false)
  const serverError = shallowRef(false)

  async function load(force = false) {
    // política de cache unificada: já carregado e sem force → não refaz o fetch
    if (data.value && !force)
      return
    // estado por tentativa: quem observa vira false→true a cada falha de rede
    networkError.value = false
    serverError.value = false
    try {
      const url = `${import.meta.env.BASE_URL}data/${path}`
      const res = await fetch(force ? `${url}?t=${Date.now()}` : url)
      if (!res.ok) {
        // HTTP >= 500 = erro do SERVIDOR dos dados (issue #237): caminho de
        // feedback próprio, distinto de rede (TypeError) e de sem-arquivo
        // (404/HTML segue o caminho sintético de baixo)
        serverError.value = res.status >= 500
        throw new Error(opts.httpError ? opts.httpError(res.status) : `HTTP ${res.status}`)
      }
      // SPA fallback (dev/preview): um JSON ausente devolve index.html com
      // status 200 — content-type text/html ou parse quebrado = arquivo não
      // coletado, reportado como o MESMO erro do 404 real (issue #147): a
      // mensagem fixa que a UI concatena (opts.errorMessage) fica preservada
      const notFound = () => new Error(opts.httpError ? opts.httpError(404) : 'HTTP 404')
      if (res.headers.get('content-type')?.includes('text/html'))
        throw notFound()
      let json: unknown
      try {
        json = await res.json()
      }
      catch {
        throw notFound()
      }
      data.value = markRawPayload((opts.pick ?? ((raw: unknown) => raw as T))(json))
      error.value = null
    }
    catch (err) {
      const e = err as Error
      // TypeError é o que o fetch rejeita em falha de REDE (spec) — distinto
      // dos erros sintéticos acima (HTTP não-OK / sem arquivo), todos Error
      networkError.value = e instanceof TypeError
      // onErrorValue define o dado em falha; sem ele, o valor atual é preservado
      if (opts.onErrorValue !== undefined)
        data.value = markRawPayload(opts.onErrorValue)
      error.value = typeof opts.errorMessage === 'function'
        ? opts.errorMessage(e)
        : opts.errorMessage ?? String(e.message ?? e)
    }
  }

  return { data, error, networkError, serverError, load }
}
