import type { ReportCommitsData } from './types'
import { markRaw, shallowRef } from 'vue'
import { validateReportCommitsData } from './report-commits'

// Nenhum fetch no import nem com o anexo desligado. Este módulo reativo fica
// separado do núcleo puro, também consumido pelos coletores fora do Vite/Vue.
export const reportCommits = shallowRef<ReportCommitsData | null>(null)
export const reportCommitsLoading = shallowRef(false)
export const reportCommitsError = shallowRef<string | null>(null)
export const reportCommitsActive = shallowRef(false)

let inFlight: Promise<void> | null = null
let requestVersion = 0

async function fetchReportCommits(force: boolean): Promise<void> {
  const version = ++requestVersion
  reportCommitsLoading.value = true
  reportCommitsError.value = null
  const promise = (async () => {
    try {
      const url = `${import.meta.env.BASE_URL}data/report-commits.json`
      const response = await fetch(force ? `${url}?t=${Date.now()}` : url)
      if (!response.ok)
        throw new Error(`HTTP ${response.status}`)
      if (response.headers.get('content-type')?.includes('text/html'))
        throw new Error('HTTP 404')
      let json: unknown
      try {
        json = await response.json()
      }
      catch {
        throw new Error('HTTP 404')
      }
      const errors = validateReportCommitsData(json)
      if (errors.length)
        throw new Error(errors[0])
      if (version !== requestVersion)
        return
      reportCommits.value = markRaw(json as ReportCommitsData)
      reportCommitsError.value = null
    }
    catch (error) {
      if (version !== requestVersion)
        return
      reportCommits.value = null
      reportCommitsError.value = error instanceof Error ? error.message : String(error)
    }
    finally {
      if (version === requestVersion) {
        reportCommitsLoading.value = false
        inFlight = null
      }
    }
  })()
  inFlight = promise
  await promise
}

/** Requests normais compartilham o fluxo; force cria uma geração com cache-bust. */
export function loadReportCommits(force = false): Promise<void> {
  if (!force && inFlight)
    return inFlight
  if (!force && reportCommits.value && !reportCommitsError.value)
    return Promise.resolve()
  return fetchReportCommits(force)
}

/** Controla se uma recoleta pode atualizar este artefato lazy. */
export function setReportCommitsActive(active: boolean): Promise<void> {
  reportCommitsActive.value = active
  return active ? loadReportCommits() : Promise.resolve()
}
