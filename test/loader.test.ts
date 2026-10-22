import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineLoader } from '../src/loader'

/**
 * Issue #249 — estados do loader (200 / 404 / 500 / rede / SPA fallback),
 * stubando `globalThis.fetch` (a linha 56 chama o fetch global). Cenário com
 * loader/path fresco: o cache de "já carregado" é interno por loader.
 */

function jsonResponse(json: unknown, contentType = 'application/json') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => (h === 'content-type' ? contentType : null) },
    json: async () => json,
  }
}

function httpResponse(status: number) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => ({}),
  }
}

/** stub do fetch global; devolve a lista de URLs pedidas para as asserções de cache */
function stubFetch(impl: () => unknown): string[] {
  const urls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url)
    return impl()
  }))
  return urls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('defineLoader — sucesso', () => {
  it('200: grava o payload, limpa erro e não liga flags', async () => {
    const urls = stubFetch(() => jsonResponse({ repos: ['demo-api'] }))
    const loader = defineLoader<{ repos: string[] }>('stats.json')

    await loader.load()

    expect(loader.data.value).toEqual({ repos: ['demo-api'] })
    expect(loader.error.value).toBeNull()
    expect(loader.networkError.value).toBe(false)
    expect(loader.serverError.value).toBe(false)
    expect(urls).toEqual([`${import.meta.env.BASE_URL}data/stats.json`])
  })

  it('pick extrai o campo; sem pick o JSON inteiro vira o dado', async () => {
    stubFetch(() => jsonResponse({ commits: [{ hash: 'a' }], extra: 1 }))
    const picked = defineLoader<{ hash: string }[]>('commits.json', {
      pick: json => (json as { commits: { hash: string }[] }).commits,
    })
    const whole = defineLoader<unknown>('anything.json')

    await picked.load()
    await whole.load()

    expect(picked.data.value).toEqual([{ hash: 'a' }])
    expect(whole.data.value).toEqual({ commits: [{ hash: 'a' }], extra: 1 })
  })

  it('cache: sem force não refaz o fetch; force adiciona ?t=', async () => {
    const urls = stubFetch(() => jsonResponse({ ok: 1 }))
    const loader = defineLoader('stats.json')

    await loader.load()
    await loader.load()
    expect(urls).toHaveLength(1)

    await loader.load(true)
    expect(urls).toHaveLength(2)
    expect(urls[1]).toMatch(/\?t=\d+$/)
  })
})

describe('defineLoader — falhas', () => {
  it('404: mensagem HTTP padrão, dado fica null e nem rede nem servidor', async () => {
    stubFetch(() => httpResponse(404))
    const loader = defineLoader('stats.json')

    await loader.load()

    expect(loader.error.value).toBe('HTTP 404')
    expect(loader.data.value).toBeNull()
    expect(loader.networkError.value).toBe(false)
    expect(loader.serverError.value).toBe(false)
  })

  it('500: liga serverError e usa o httpError custom do chamador', async () => {
    stubFetch(() => httpResponse(500))
    const loader = defineLoader('stats.json', {
      httpError: status => `HTTP ${status} — rode a coleta`,
    })

    await loader.load()

    expect(loader.error.value).toBe('HTTP 500 — rode a coleta')
    expect(loader.serverError.value).toBe(true)
    expect(loader.networkError.value).toBe(false)
  })

  it('rede (TypeError): networkError true e o resto limpo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed')
    }))
    const loader = defineLoader('stats.json')

    await loader.load()

    expect(loader.error.value).toBe('fetch failed')
    expect(loader.networkError.value).toBe(true)
    expect(loader.serverError.value).toBe(false)
  })

  it('fallback do SPA: 200 text/html conta como arquivo ausente (HTTP 404)', async () => {
    stubFetch(() => jsonResponse('<!doctype html><title>index</title>', 'text/html; charset=utf-8'))
    const loader = defineLoader('stats.json')

    await loader.load()

    expect(loader.error.value).toBe('HTTP 404')
    expect(loader.data.value).toBeNull()
  })

  it('resposta com JSON quebrado conta como arquivo ausente, não como erro de rede', async () => {
    stubFetch(() => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON')
      },
    }))
    const loader = defineLoader('stats.json')

    await loader.load()

    expect(loader.error.value).toBe('HTTP 404')
    expect(loader.networkError.value).toBe(false)
  })

  it('errorMessage fixa vs função derivada do erro', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('fetch failed')
    }))
    const fixed = defineLoader('stats.json', { errorMessage: 'sem dados do GitHub' })
    const derived = defineLoader('stats.json', { errorMessage: err => `erro: ${err.name}` })

    await fixed.load()
    await derived.load()

    expect(fixed.error.value).toBe('sem dados do GitHub')
    expect(derived.error.value).toBe('erro: TypeError')
  })

  it('onErrorValue define o dado em falha; sem ele o valor atual é preservado', async () => {
    let fail = false
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (fail)
        throw new TypeError('fetch failed')
      return jsonResponse({ commits: 1 })
    }))
    const keep = defineLoader<{ commits: number }>('stats.json')
    const reset = defineLoader<{ commits: number }[]>('commits.json', { onErrorValue: [] })

    await keep.load()
    await reset.load()
    fail = true
    await keep.load(true)
    await reset.load(true)

    expect(keep.data.value).toEqual({ commits: 1 }) // preservado (sem onErrorValue)
    expect(keep.error.value).toBe('fetch failed')
    expect(reset.data.value).toEqual([]) // esvaziado (onErrorValue)
    expect(reset.error.value).toBe('fetch failed')
  })
})
