import type { DailyRow } from './types'
import { defineLoader } from './loader'

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
    return rows as DailyRow[]
  },
})
export const daily = dailyLoader.data
export const loadDaily = dailyLoader.load
