import type { DailyRow } from './types'
import { shallowRef } from 'vue'
import { defineLoader } from './loader'

export const dailyGeneratedAt = shallowRef<string | null>(null)
export const dailyLoading = shallowRef(false)
let dailyRequests = 0

/**
 * Loader do daily.json (agregado dia-preciso, issue #175) — dado OPCIONAL p/ o
 * app (issue #176): coleta anterior à feature não gera o arquivo e o SPA
 * fallback devolve index.html 200 para JSON ausente (guarda de parse no
 * próprio defineLoader + guarda de shape no pick abaixo). Ausência ou falha →
 * `null`: os consumidores fazem feature-detect e caim no fallback de
 * `stats.weekly` (zero erro bloqueante no caminho do resumo semanal).
 */
const dailyLoader = defineLoader<DailyRow[]>('daily.json', {
  pick: (json) => {
    const rows = (json as { daily?: unknown }).daily
    if (!Array.isArray(rows))
      throw new Error('daily.json sem lista daily[]')
    const generatedAt = (json as { generatedAt?: unknown }).generatedAt
    dailyGeneratedAt.value = typeof generatedAt === 'string' ? generatedAt : null
    return rows as DailyRow[]
  },
})
export const daily = dailyLoader.data
export const dailyError = dailyLoader.error
export async function loadDaily(force = false): Promise<void> {
  dailyRequests++
  dailyLoading.value = true
  try {
    await dailyLoader.load(force)
  }
  finally {
    dailyRequests--
    dailyLoading.value = dailyRequests > 0
  }
}
