import { afterEach, describe, expect, it, vi } from 'vitest'

function jsonResponse(json: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: () => 'application/json' },
    json: async () => json,
  }
}

async function freshModule() {
  vi.resetModules()
  return import('../src/daily')
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('daily loader — metadados do snapshot e estado de carga', () => {
  it('expõe loading durante o fetch, guarda generatedAt e faz cache-bust no refresh', async () => {
    let resolveFirst!: (value: ReturnType<typeof jsonResponse>) => void
    const payload = { generatedAt: '2026-10-15T12:00:00.000Z', daily: [] }
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => new Promise<ReturnType<typeof jsonResponse>>((resolve) => {
        resolveFirst = resolve
      }))
      .mockImplementation(async () => jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)
    const module = await freshModule()

    const first = module.loadDaily()
    expect(module.dailyLoading.value).toBe(true)
    resolveFirst(jsonResponse(payload))
    await first

    expect(module.dailyLoading.value).toBe(false)
    expect(module.daily.value).toEqual([])
    expect(module.dailyGeneratedAt.value).toBe(payload.generatedAt)
    expect(module.dailyError.value).toBeNull()

    await module.loadDaily()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await module.loadDaily(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toMatch(/daily\.json\?t=\d+$/)
  })

  it('fecha loading em erro e preserva o snapshot anterior para o motor bloquear pelo erro', async () => {
    const payload = { generatedAt: '2026-10-15T12:00:00.000Z', daily: [{ day: '2026-10-15' }] }
    vi.stubGlobal('fetch', vi.fn()
      .mockImplementationOnce(async () => jsonResponse(payload))
      .mockImplementationOnce(async () => {
        throw new TypeError('offline')
      }))
    const module = await freshModule()
    await module.loadDaily()

    await module.loadDaily(true)

    expect(module.dailyLoading.value).toBe(false)
    expect(module.daily.value).toEqual(payload.daily)
    expect(module.dailyGeneratedAt.value).toBe(payload.generatedAt)
    expect(module.dailyError.value).toBe('offline')
  })
})
