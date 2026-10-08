/**
 * Limpeza dos dados gerados — tudo é regenerável pelos coletores.
 * Compartilhada entre o CLI (`pnpm clean`) e o endpoint /__collect?clean=1.
 */
import { existsSync, readdirSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { rootDir } from './config'

/**
 * Apaga o banco (data/*, exceto os clones) e os JSONs (public/data/*.json).
 * includeRepos=true também remove os clones gerenciados (data/repos) — a
 * próxima coleta precisa re-clonar (pesado), então fica fora do padrão.
 * Retorna os caminhos removidos (relativos à raiz) para log.
 */
export function cleanLocalData(includeRepos = false): string[] {
  const removed: string[] = []
  const rm = (p: string) => {
    if (!existsSync(p)) return
    rmSync(p, { recursive: true, force: true })
    removed.push(relative(rootDir, p))
  }

  const dataDir = join(rootDir, 'data')
  if (existsSync(dataDir)) {
    for (const f of readdirSync(dataDir)) {
      if (f === 'repos' && !includeRepos) continue
      rm(join(dataDir, f)) // gitview.db (+ -wal/-shm) e, opcionalmente, repos/
    }
  }

  const publicData = join(rootDir, 'public', 'data')
  if (existsSync(publicData)) {
    for (const f of readdirSync(publicData)) {
      if (f.endsWith('.json')) rm(join(publicData, f))
    }
  }

  return removed
}
