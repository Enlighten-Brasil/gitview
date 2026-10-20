/**
 * Log de execução dos scripts de coleta: timestamp relativo no console +
 * espelho em `data/logs/<passo>-<data>.log` + heartbeat de silêncio.
 *
 * Resolve o diagnóstico remoto ("travou sem erro aparente"): a última linha do
 * log diz EM QUE passo o processo parou, e o heartbeat mantém o console e o
 * SSE da UI (/__collect) mostrando que o processo segue vivo e há quanto tempo
 * não sai nada — os passos longos e silenciosos (git fetch/clone, git log
 * --numstat de repo grande, migrações do banco) ficam identificáveis.
 */
import { appendFileSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { inspect } from 'node:util'
import { rootDir } from './config'

/** ms de silêncio antes do heartbeat "ainda rodando" */
const HEARTBEAT_MS = 30_000
/** quantos arquivos de log manter em data/logs (os mais recentes) */
const KEEP_LOGS = 30

const t0 = Date.now()
let logFile: string | null = null
let lastOut = Date.now()
let lastLine = '(nenhuma saída ainda)'
let wrapped = false

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

function fmt(args: unknown[]): string {
  return args.map(a => typeof a === 'string' ? a : inspect(a, { depth: 3 })).join(' ')
}

function emit(stream: NodeJS.WriteStream, line: string): void {
  lastOut = Date.now()
  lastLine = line
  stream.write(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${line}\n`)
  if (logFile) {
    // best-effort: log nunca derruba a coleta
    try {
      appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`)
    }
    catch {}
  }
}

/** remove os logs antigos — mantém só os KEEP_LOGS mais recentes */
function pruneLogs(dir: string): void {
  const old = readdirSync(dir).filter(f => f.endsWith('.log')).sort()
  for (const f of old.slice(0, Math.max(0, old.length - KEEP_LOGS)))
    rmSync(join(dir, f), { force: true })
}

/**
 * Liga o log para este passo (1x por processo, antes de qualquer saída):
 * console.log/warn/error viram linhas com timestamp relativo, espelhadas em
 * data/logs/. O heartbeat imprime a cada 30s de silêncio.
 */
export function initLog(step: string): void {
  try {
    const dir = join(rootDir, 'data', 'logs')
    mkdirSync(dir, { recursive: true })
    pruneLogs(dir)
    logFile = join(dir, `${step}-${stamp()}.log`)
    writeFileSync(logFile, `# gitview ${step} · ${new Date().toISOString()} · node ${process.version} · ${process.platform} ${process.arch}\n`)
  }
  catch {
    logFile = null // sem arquivo o timestamp no console segue valendo
  }
  if (!wrapped) {
    wrapped = true
    console.log = (...args: unknown[]) => emit(process.stdout, fmt(args))
    console.warn = (...args: unknown[]) => emit(process.stderr, fmt(args))
    console.error = (...args: unknown[]) => emit(process.stderr, fmt(args))
  }
  const beat = setInterval(() => {
    if (Date.now() - lastOut >= HEARTBEAT_MS)
      emit(process.stderr, `⏳ ${step}: ${Math.round((Date.now() - lastOut) / 1000)}s sem saída — última linha: ${lastLine}`)
  }, HEARTBEAT_MS)
  beat.unref() // não segura o processo vivo
}
