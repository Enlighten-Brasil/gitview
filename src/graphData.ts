import type { GraphData } from './types'
import { markRaw } from 'vue'

/**
 * Loader por repo do `graph-REPO.json` (issue #127). O `defineLoader`
 * (loader.ts) toma caminho estático — o grafo é um JSON POR REPO, então o
 * cache é um Map chaveado pelo nome (decisão #39: o payload entra na
 * reatividade via shallowRef + markRaw no consumidor, sem proxy profundo dos
 * ~1000 commits). Cache-bust `?t=` no force: mesma política dos loaders.
 * Falha NÃO fica em cache — a próxima entrada tenta de novo (o empty-state
 * "rode pnpm collect" só vale para o que realmente não foi coletado).
 */
const cache = new Map<string, Promise<GraphData>>()

export interface GraphLoadError extends Error {
  /** status HTTP do fetch (404 = repo sem grafo coletado) */
  status?: number
}

export function loadGraphData(repo: string, force = false): Promise<GraphData> {
  if (!force) {
    const hit = cache.get(repo)
    if (hit)
      return hit
  }
  const url = `${import.meta.env.BASE_URL}data/graph-${encodeURIComponent(repo)}.json`
  const p = (async () => {
    const res = await fetch(force ? `${url}?t=${Date.now()}` : url)
    const httpErr = (status: number) => {
      const err = new Error(`HTTP ${status}`) as GraphLoadError
      err.status = status
      return err
    }
    if (!res.ok)
      throw httpErr(res.status)
    let json: unknown
    try {
      json = await res.json()
    }
    catch {
      // dev server: o SPA fallback devolve index.html (200, text/html) para
      // um JSON que não existe — parse quebrado = arquivo não coletado
      throw httpErr(404)
    }
    const d = json as GraphData
    if (!d || !Array.isArray(d.commits))
      throw httpErr(404) // shape fora do contrato (types.ts#GraphData)
    return markRaw(d)
  })()
  cache.set(repo, p)
  p.catch(() => cache.delete(repo))
  return p
}
