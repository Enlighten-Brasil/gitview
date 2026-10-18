/**
 * scripts/make-doc-shots.ts — regenera as capturas da demo pública que vivem
 * versionadas em `docs/public/screenshots/` (usadas no site de docs e no
 * README — issue #96).
 *
 * Proteção de privacidade primeiro: o script VERIFICA que `public/data/` é o
 * fixture sintético (`scripts/make-demo-data.ts`: devs Ana/Beto, repos `demo-*`)
 * e recusa capturar qualquer outra coisa. Assim é impossível commitar, por
 * descuido, uma imagem com nome/e-mail/nome real de repositório do time.
 *
 * Zero dependência nova: usa o Chrome/Chromium instalado em modo headless com
 * um perfil temporário (nada de Playwright/Puppeteer no projeto). Aponte
 * GITVIEW_CHROME se o seu binário não estiver nos caminhos padrão.
 *
 * Uso (num clone/worktree limpo, ou depois de gerar o fixture sintético):
 *   pnpm exec tsx scripts/make-demo-data.ts --force
 *   pnpm demo:shots
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { get } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

const OUT_DIR = 'docs/public/screenshots'
const PORT = Number(process.env.GITVIEW_SHOTS_PORT ?? '4321')
const HOST = `http://localhost:${PORT}`
const SERVER_TIMEOUT_MS = 20_000

/** As quatro capturas da doc: arquivo, rota, largura, altura. */
interface Shot {
  file: string
  route: string
  width: number
  height: number
}

const SHOTS: Shot[] = [
  { file: 'overview.png', route: '/', width: 1440, height: 900 },
  { file: 'prs.png', route: '/prs', width: 1440, height: 900 },
  { file: 'health.png', route: '/health', width: 1440, height: 1250 },
  { file: 'dev.png', route: '/devs/Ana', width: 1440, height: 1400 },
]

/** shape mínimo do que a checagem de fixture lê dos JSONs coletados */
interface TeamData {
  devs?: { name?: string }[]
}
interface StatsData {
  repos?: string[]
}

function fail(message: string): never {
  console.error(`✗ make-doc-shots: ${message}`)
  process.exit(1)
}

function readData(file: string): string {
  return readFileSync(join('public', 'data', file), 'utf8')
}

/** as capturas só podem sair da demo fictícia — nunca dos dados reais do time */
function assertSyntheticFixture(): void {
  const dataDir = join('public', 'data')
  for (const f of ['team.json', 'stats.json']) {
    if (!existsSync(join(dataDir, f)))
      fail(`falta ${dataDir}/${f} — gere o fixture com \`pnpm exec tsx scripts/make-demo-data.ts --force\` (num clone limpo)`)
  }

  const team = JSON.parse(readData('team.json')) as TeamData
  const stats = JSON.parse(readData('stats.json')) as StatsData
  const devs = (team.devs ?? []).map(d => d.name ?? '')
  const repos = stats.repos ?? []

  const devsOk = devs.length > 0 && devs.every(n => n === 'Ana' || n === 'Beto')
  const reposOk = repos.length > 0 && repos.every(r => r.startsWith('demo-'))
  if (!devsOk || !reposOk)
    fail(`public/data/ não é o fixture sintético (devs: ${devs.join(', ') || '?'} · repos: ${repos.join(', ') || '?'}) — rode num clone/worktree limpo com make-demo-data`)

  console.log(`✓ fixture sintético confirmado (${devs.length} devs, ${repos.length} repos)`)
}

/** Chrome/Chromium: env GITVIEW_CHROME ou os caminhos conhecidos por SO. */
function findChrome(): string {
  const fromEnv = process.env.GITVIEW_CHROME
  if (fromEnv) {
    if (!existsSync(fromEnv))
      fail(`GITVIEW_CHROME aponta para algo que não existe: ${fromEnv}`)
    return fromEnv
  }

  const candidates = process.platform === 'win32'
    ? [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']

  for (const c of candidates) {
    if (existsSync(c))
      return c
  }
  fail('nenhum Chrome/Chromium encontrado — aponte GITVIEW_CHROME para o binário do browser')
}

/** espera o preview responder (o Vite leva um momento para servir o dist) */
async function waitForServer(): Promise<void> {
  const deadline = Date.now() + SERVER_TIMEOUT_MS
  for (;;) {
    const ok = await new Promise<boolean>((resolve) => {
      const req = get(`${HOST}/`, (res) => {
        res.resume()
        resolve(res.statusCode != null && res.statusCode < 500)
      })
      req.setTimeout(1500, () => req.destroy())
      req.on('error', () => resolve(false))
    })
    if (ok)
      return
    if (Date.now() > deadline)
      fail(`preview não respondeu em ${HOST} dentro de ${SERVER_TIMEOUT_MS}ms`)
    await new Promise(r => setTimeout(r, 250))
  }
}

/** um chrome headless por captura, com perfil temporário, travando até o PNG sair */
function shootFile(chrome: string, shot: Shot): void {
  const out = resolve(OUT_DIR, shot.file)
  const profile = join(tmpdir(), `gitview-shots-${process.pid}`)
  const result = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    `--user-data-dir=${profile}`,
    '--force-dark-mode',
    `--window-size=${shot.width},${shot.height}`,
    '--hide-scrollbars',
    // dá tempo dos JSONs de public/data entrarem no ECharts antes do clique zero
    '--virtual-time-budget=15000',
    `--screenshot=${out}`,
    `${HOST}${shot.route}`,
  ], { stdio: 'inherit' })

  if (result.status !== 0 || !existsSync(out))
    fail(`captura falhou para ${shot.route} (exit ${result.status})`)
  console.log(`  ✓ ${shot.file} ← ${shot.route} (${Math.round(statSync(out).size / 1024)} KB)`)
}

mkdirSync(OUT_DIR, { recursive: true })
assertSyntheticFixture()
const chrome = findChrome()

console.log('→ build do app (dist estático, o mesmo que a demo publica)')
const build = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { stdio: 'inherit' })
if (build.status !== 0)
  fail('build do app falhou')

console.log(`→ preview em ${HOST} + ${SHOTS.length} capturas (dark, perfil temporário)`)
const preview = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js',
  'preview',
  '--port',
  String(PORT),
  '--strictPort',
], { stdio: 'ignore' })

try {
  await waitForServer()
  for (const shot of SHOTS)
    shootFile(chrome, shot)
}
finally {
  preview.kill()
  rmSync(join(tmpdir(), `gitview-shots-${process.pid}`), { recursive: true, force: true })
}

console.log(`✓ capturas atualizadas em ${OUT_DIR}/ — confira o site com \`pnpm.cmd docs:build\``)
