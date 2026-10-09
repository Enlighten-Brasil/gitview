import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { loadConfig } from './scripts/lib/config'
import { collectPlugin } from './scripts/collect-plugin'
import { setupPlugin } from './scripts/setup-plugin'

// porta do dev server vem do .env (GITVIEW_PORT) — lida no boot, sem restart
// por config de máquina: envDir: false desliga o load/restart automático do
// Vite no .env (o setup grava token/reposRoot COM o servidor rodando)
const config = loadConfig()

export default defineConfig({
  base: './',
  envDir: false,
  plugins: [
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
