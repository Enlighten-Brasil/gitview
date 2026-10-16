import { fileURLToPath } from 'node:url'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { getFileBasedRouteName } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'
import { collectPlugin } from './scripts/collect-plugin'
import { loadConfig } from './scripts/lib/config'
import { setupPlugin } from './scripts/setup-plugin'

// porta do dev server vem do .env (GITVIEW_PORT) — lida no boot, sem restart
// por config de máquina: envDir: false desliga o load/restart automático do
// Vite no .env (o setup grava token/reposRoot COM o servidor rodando)
const config = loadConfig()

export default defineConfig({
  // base absoluto: history mode + SPA fallback — deep links (/devs/x) só funcionam
  // servidos, então assets relativo ('./') quebraria (procuraria /devs/assets/...)
  base: '/',
  envDir: false,
  plugins: [
    // rotas por arquivo em src/pages (vue-router 5). Nomes sem grupos (app)/(dashboard):
    // /(app)/devs/[name] → "/devs/[name]" — navegação tipada igual às URLs.
    // Ditos do nome plano viram barra (teams.[name] → /teams/[name]) — mantém o
    // nome igual à URL também nas rotas escritas com '.' p/ não aninhar UI.
    VueRouter({
      dts: 'src/route-map.d.ts',
      getRouteName: (node) => {
        // separadores '.' do nome plano viram '/' (teams.[name] → /teams/[name]);
        // dots DENTRO de colchetes são sintaxe de param ([...path]) — preservados
        let depth = 0
        const raw = [...getFileBasedRouteName(node)].map((c) => {
          if (c === '[')
            depth++
          else if (c === ']')
            depth--
          return c === '.' && depth === 0 ? '/' : c
        }).join('')
        const clean = `/${raw.split('/').filter(s => s && !/^\(.*\)$/.test(s)).join('/')}`
        return clean === '/' ? '/' : clean.replace(/\/$/, '')
      },
    }),
    vue(),
    collectPlugin(),
    setupPlugin(),
    ui({
      ui: {
        colors: {
          primary: 'blue',
          secondary: 'violet',
          info: 'sky',
          success: 'emerald',
          warning: 'amber',
          error: 'rose',
          neutral: 'slate',
        },
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: config.port ?? 5173,
    fs: {
      // o dev server serve qualquer arquivo da raiz por padrão — nega os que
      // têm dado pessoal/segredo (os defaults do Vite já cobrem .env/*.pem)
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        'team.local.json',
        'config.local.json*',
        '**/data/**',
      ],
    },
    watch: {
      // data/repos tem milhares de objetos git (bare clones) — não interessa
      // vigiar isso; nada em data/ precisa de HMR
      ignored: ['**/data/**', '**/team.local.json'],
    },
  },
})
