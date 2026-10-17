/**
 * Estado da coleta disparada pela UI (apenas dev — o endpoint /__collect
 * é um middleware do Vite, não existe no build estático).
 */
import { loadCommits, loadStats, recentCommits } from './data'
import { loadGithub } from './github'
import { loadReleases } from './releases'
import { useSseProgress } from './sse'
import { loadTeam } from './team'

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

const progress = useSseProgress('/__collect', {
  busyMessage: 'já existe uma coleta em andamento',
  disconnectMessage: 'conexão com o dev server caiu durante a coleta',
  // os loaders refazem o fetch com cache-bust antes de concluir
  onDone: reloadData,
})

export const collecting = progress.running
export const collectStep = progress.step
export const collectLog = progress.log
export const collectError = progress.error
/** vira true ao concluir — a UI mostra toast e reseta */
export const collectSucceeded = progress.done

export function startCollect(full = false, clean = false, light = false) {
  const params: Record<string, string> = {}
  if (full || clean)
    params.full = '1'
  if (clean)
    params.clean = '1'
  if (light && !full && !clean)
    params.light = '1'
  progress.start(params)
}
