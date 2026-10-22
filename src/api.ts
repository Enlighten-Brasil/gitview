/**
 * Helpers HTTP dos clientes dos endpoints dev-only (setup/team): parse de
 * corpo + tratamento de erro num lugar só. Falha HTTP vira `HttpError`
 * (mensagem idêntica à dos helpers originais: `body.error` do JSON da
 * resposta ou `HTTP ${status}`), com status e corpo tipados para quem
 * precisar tratar 4xx/5xx sem parsear a mensagem.
 */

/** erro HTTP com status e corpo — mensagem igual à dos helpers originais */
class HttpError extends Error {
  status: number
  body: unknown

  constructor(status: number, message: string, body?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new HttpError(res.status, (body as { error?: string }).error ?? `HTTP ${res.status}`, body)
  return body as T
}

export function getJson<T>(url: string, opts?: { signal?: AbortSignal }): Promise<T> {
  return request<T>(url, opts?.signal ? { signal: opts.signal } : undefined)
}

export function postJson<T>(url: string, body: unknown, opts?: { signal?: AbortSignal }): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts?.signal,
  })
}
