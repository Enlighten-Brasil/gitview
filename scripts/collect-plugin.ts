/**
 * Plugin Vite (apenas dev): expõe GET /__collect como stream SSE que roda os
 * três coletores em sequência e transmite o progresso linha a linha.
 *
 * - `?full=1` repassa `--full` (re-scan completo do git + refetch total de PRs)
 * - lock em memória: uma coleta por vez (segunda requisição recebe evento `busy`)
 * - no build estático o endpoint não existe — o botão da UI só aparece em dev
 */
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Connect, Plugin } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')

const STEPS = [
  { script: 'scripts/collect.ts', label: 'commits' },
  { script: 'scripts/collect-github.ts', label: 'pull requests' },
  { script: 'scripts/collect-releases.ts', label: 'releases' },
]

let running = false

function runStep(script: string, full: boolean, onLine: (line: string) => void): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const args = [tsxCli, script]
    if (full) args.push('--full')
    const child = spawn(process.execPath, args, { cwd: root })
    let buf = ''
    const onData = (c: Buffer) => {
      buf += c.toString('utf-8')
      const lines = buf.split(/\r?\n/)
      buf = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) onLine(line)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', reject)
    child.on('close', (code) => {
      if (buf.trim()) onLine(buf)
      if (code === 0) resolvePromise()
      else reject(new Error(`${script} saiu com código ${code}`))
    })
  })
}

export function collectPlugin(): Plugin {
  return {
    name: 'gitview-collect',
    apply: 'serve', // só no dev server
    configureServer(server) {
      const handler: Connect.NextHandleFunction = (req, res) => {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        })
        const send = (event: string, data: unknown) => {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        }

        if (running) {
          send('busy', {})
          res.end()
          return
        }
        running = true
        const full = new URL(req.url ?? '', 'http://localhost').searchParams.get('full') === '1'

        ;(async () => {
          for (const step of STEPS) {
            send('step', { label: step.label })
            await runStep(step.script, full, line => send('log', { line }))
          }
          send('done', {})
        })()
          .catch(err => send('error', { message: String((err as Error).message ?? err) }))
          .finally(() => {
            running = false
            res.end()
          })

        // cliente desconectou (fechou a aba): libera o lock sem matar a coleta
        req.on('close', () => {
          // o processo filho termina sozinho; o lock é liberado no finally
        })
      }
      server.middlewares.use('/__collect', handler)
    },
  }
}
