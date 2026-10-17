/**
 * Consumo dos endpoints SSE com progresso da UI (dev only): log truncado e
 * handlers `log`/`step`/`busy`/`done`/`error` num lugar só — `setup.ts` e
 * `collect.ts` viram wrappers curtos sobre `useSseProgress`.
 */
import type { Ref } from 'vue'
import { ref } from 'vue'

const MAX_LOG_LINES = 300

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
      step.value = JSON.parse((e as MessageEvent).data).label
    })
    es.addEventListener('log', (e) => {
      log.value.push(JSON.parse((e as MessageEvent).data).line)
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
      if (data) {
        error.value = JSON.parse(data).message
      }
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
