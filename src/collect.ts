/**
 * Estado da coleta disparada pela UI (apenas dev — o endpoint /__collect
 * é um middleware do Vite, não existe no build estático).
 */
import { ref } from 'vue'
import { loadCommits, loadStats, recentCommits } from './data'
import { loadGithub } from './github'
import { loadReleases } from './releases'
import { loadTeam } from './team'

export const collecting = ref(false)
export const collectStep = ref<string | null>(null)
export const collectLog = ref<string[]>([])
export const collectError = ref<string | null>(null)
/** vira true ao concluir — a UI mostra toast e reseta */
export const collectSucceeded = ref(false)

const MAX_LOG_LINES = 300

async function reloadData() {
  recentCommits.value = null // força refetch na próxima visita ao perfil do dev
  await Promise.all([
    loadStats(true),
    loadGithub(true),
    loadReleases(true),
    loadCommits(true),
    loadTeam(true),
  ])
}

export function startCollect(full = false, clean = false, light = false) {
  if (collecting.value) return
  collecting.value = true
  collectStep.value = null
  collectLog.value = []
  collectError.value = null
  collectSucceeded.value = false

  const params = new URLSearchParams()
  if (full || clean) params.set('full', '1')
  if (clean) params.set('clean', '1')
  if (light && !full && !clean) params.set('light', '1')
  const qs = params.toString()
  const es = new EventSource(`/__collect${qs ? `?${qs}` : ''}`)

  es.addEventListener('step', (e) => {
    collectStep.value = JSON.parse((e as MessageEvent).data).label
  })
  es.addEventListener('log', (e) => {
    collectLog.value.push(JSON.parse((e as MessageEvent).data).line)
    if (collectLog.value.length > MAX_LOG_LINES) {
      collectLog.value.splice(0, collectLog.value.length - MAX_LOG_LINES)
    }
  })
  es.addEventListener('busy', () => {
    collectError.value = 'já existe uma coleta em andamento'
    es.close()
    collecting.value = false
  })
  es.addEventListener('done', async () => {
    es.close()
    await reloadData()
    collecting.value = false
    collectStep.value = null
    collectSucceeded.value = true
  })
  // o servidor emite `event: error` com data; EventSource também dispara 'error'
  // genérico quando a conexão cai — diferencia pelo data
  es.addEventListener('error', (e) => {
    const data = (e as MessageEvent).data
    if (data) {
      collectError.value = JSON.parse(data).message
    }
    else if (!collectSucceeded.value && collecting.value) {
      collectError.value = 'conexão com o dev server caiu durante a coleta'
    }
    es.close()
    collecting.value = false
    collectStep.value = null
  })
}
