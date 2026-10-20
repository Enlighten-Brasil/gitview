import type { Buffer } from 'node:buffer'
import type { Connect, Plugin } from 'vite'
/**
 * Plugin Vite (apenas dev): expõe GET /__collect como stream SSE que roda os
 * seis coletores em sequência, mais a verificação final (check-data), e
 * transmite o progresso linha a linha. No modo leve (`?light=1`) re-agrega
 * commits e pula releases, branches e graph.
 *
 * - `?full=1` repassa `--full` (re-scan completo do git + refetch total de PRs)
 * - `?clean=1` apaga banco + JSONs antes de coletar (implica full)
 * - lock em memória: uma coleta por vez (segunda requisição recebe evento `busy`)
 * - no build estático o endpoint não existe — o botão da UI só aparece em dev
 */
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { cleanLocalData } from './lib/clean'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const tsxCli = join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs')

interface CollectStep { script: string, label: string, args?: string[] }

const STEPS: CollectStep[] = [
  { script: 'scripts/collect.ts', label: 'commits' },
  { script: 'scripts/collect-github.ts', label: 'pull requests' },
  { script: 'scripts/collect-branches.ts', label: 'branches' },
  { script: 'scripts/collect-graph.ts', label: 'graph' },
  { script: 'scripts/collect-releases.ts', label: 'releases' },
  { script: 'scripts/collect-team.ts', label: 'time' },
  { script: 'scripts/check-data.ts', label: 'verificação' },
]

// ?light=1 (edição de time/aliases em /teams): sem git fetch/scan nem releases —
// re-agrega o banco com os aliases novos, incremental de PRs, team + verificação.
// collect-branches e collect-graph ficam FORA de propósito (issues #123/#126):
// a light não faz fetch nem escaneia git, então re-enumerar produziria
// resultado idêntico ao do último full, só com custo. Os graph-*.json
// existentes SOBREVIVEM à light (nada os reescreve nem apaga) — o check-data
// valida os arquivos presentes e repo do stats sem graph-*.json é aviso, não
// erro.
const STEPS_LIGHT: CollectStep[] = [
  { script: 'scripts/collect.ts', label: 'commits (reagregação)', args: ['--reaggregate'] },
  { script: 'scripts/collect-github.ts', label: 'pull requests' },
  { script: 'scripts/collect-team.ts', label: 'time' },
  { script: 'scripts/check-data.ts', label: 'verificação' },
]

let running = false

function runStep(script: string, args: string[], onLine: (line: string) => void): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [tsxCli, script, ...args], { cwd: root })
    let buf = ''
    const onData = (c: Buffer) => {
      buf += c.toString('utf-8')
      const lines = buf.split(/\r?\n/)
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (line.trim())
          onLine(line)
      }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('error', reject)
    child.on('close', (code) => {
      if (buf.trim())
        onLine(buf)
      if (code === 0)
        resolvePromise()
      else reject(new Error(`${script} saiu com código ${code}`))
    })
  })
}

export function collectPlugin(): Plugin {
  return {
    name: 'gitview-collect',
    apply: 'serve', // só no dev server
    configureServer(server) {
      // /data/*.json direto do disco, ANTES dos middlewares internos do Vite:
      // o fs.deny '**/data/**' protege o data/ (banco + clones), e o snapshot
      // publicFiles do Vite só conhece arquivo de public/ visto no boot (o
      // watcher ignora '**/data/**'). Sem isto, os JSONs escritos pela 1ª
      // coleta de uma instância nova nunca são servidos: o boot lê index.html
      // no lugar do stats.json, decide "sem dados" e o guard manda /setup para
      // sempre. Semântica igual à que o loader espera: arquivo ausente cai no
      // próximo middleware (SPA fallback vira 404 sintético no loader).
      server.middlewares.use('/data', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\/+/, '')
        // só JSON simples de public/data/ — sem separador de caminho não há traversal
        if (!/^[\w.-]+\.json$/.test(name))
          return next()
        const file = join(root, 'public', 'data', name)
        if (!existsSync(file))
          return next()
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(readFileSync(file))
      })

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
        const params = new URL(req.url ?? '', 'http://localhost').searchParams
        const clean = params.get('clean') === '1'
        const full = clean || params.get('full') === '1'
        const light = !full && params.get('light') === '1'

        ;(async () => {
          if (clean) {
            const removed = cleanLocalData()
            send('log', { line: `Limpeza: ${removed.length ? `${removed.length} itens removidos (${removed.join(', ')})` : 'nada a remover'}` })
          }
          const steps = light ? STEPS_LIGHT : STEPS
          for (const step of steps) {
            send('step', { label: step.label })
            await runStep(step.script, step.args ?? (full ? ['--full'] : []), line => send('log', { line }))
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
