/**
 * Consumo dos endpoints SSE com progresso da UI (dev only): log truncado e
 * handlers `log`/`step`/`busy`/`done`/`error` num lugar só — `setup.ts` e
 * `collect.ts` viram wrappers curtos sobre `useSseProgress`.
 */
import type { Ref } from 'vue'
import { ref } from 'vue'

const MAX_LOG_LINES = 300

// ---------------------------------------------------------------------------
// envelopes dos eventos SSE (issue #42) — o mesmo shape dos `send(...)` de
// scripts/collect-plugin.ts e scripts/setup-plugin.ts
// ---------------------------------------------------------------------------
/** envelope do evento `log` (linha de saída do script) */
export interface SseLine { line: string }
/** envelope do evento `step` (passo atual da coleta/setup) */
export interface SseStep { label: string }
/** envelope do evento `error` (o `error` genérico do EventSource não tem data) */
export interface SseError { message: string }

/**
 * parse seguro do envelope — payload malformado vira null: nunca lança dentro
 * do handler do EventSource (antes um JSON.parse solto explodia no próprio
 * handler de erro)
 */
function parseEnvelope<T extends object>(data: string, guard: (value: unknown) => value is T): T | null {
  try {
    const parsed: unknown = JSON.parse(data)
    return guard(parsed) ? parsed : null
  }
  catch {
    return null
  }
}

/** envelope tem o campo `key` como string */
function hasString<K extends string>(key: K) {
  return (value: unknown): value is Record<K, string> =>
    typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>)[key] === 'string'
}

const isSseLine = hasString('line')
const isSseStep = hasString('label')
const isSseError = hasString('message')

export interface SseProgressOptions {
  /** mensagem do handler `busy` (já existe um fluxo em andamento no servidor) */
  busyMessage: string
  /** mensagem quando a conexão cai sem o evento `error` ter data */
  disconnectMessage: string
  /** hook do `done` — await antes de concluir (reload dos loaders no collect) */
  onDone?: () => Promise<void> | void
}

export interface SseProgress {
  running: Ref<boolean>
  step: Ref<string | null>
  log: Ref<string[]>
  error: Ref<string | null>
  done: Ref<boolean>
  start: (params?: Record<string, string>) => void
}

export function useSseProgress(url: string, opts: SseProgressOptions): SseProgress {
  const running = ref(false)
  const step = ref<string | null>(null)
  const log = ref<string[]>([])
  const error = ref<string | null>(null)
  const done = ref(false)

  function start(params: Record<string, string> = {}) {
    if (running.value)
      return
    running.value = true
    step.value = null
    log.value = []
    error.value = null
    done.value = false

    const qs = new URLSearchParams(params).toString()
    const es = new EventSource(qs ? `${url}?${qs}` : url)

    es.addEventListener('step', (e) => {
      const payload = parseEnvelope<SseStep>((e as MessageEvent).data, isSseStep)
      if (payload)
        step.value = payload.label
    })
    es.addEventListener('log', (e) => {
      const payload = parseEnvelope<SseLine>((e as MessageEvent).data, isSseLine)
      if (!payload)
        return
      log.value.push(payload.line)
      if (log.value.length > MAX_LOG_LINES) {
        log.value.splice(0, log.value.length - MAX_LOG_LINES)
      }
    })
    es.addEventListener('busy', () => {
      error.value = opts.busyMessage
      es.close()
      running.value = false
    })
    es.addEventListener('done', async () => {
      es.close()
      await opts.onDone?.()
      running.value = false
      step.value = null
      done.value = true
    })
    // o servidor emite `event: error` com data; EventSource também dispara 'error'
    // genérico quando a conexão cai — diferencia pelo data
    es.addEventListener('error', (e) => {
      const data = (e as MessageEvent).data
      const payload = data ? parseEnvelope<SseError>(data, isSseError) : null
      if (payload) {
        error.value = payload.message
      }
      // sem data válida: conexão caiu (ou payload malformado) — mensagem de desconexão
      else if (!done.value && running.value) {
        error.value = opts.disconnectMessage
      }
      es.close()
      running.value = false
      step.value = null
    })
  }

  return { running, step, log, error, done, start }
}
