import { fileURLToPath } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { getFileBasedRouteName } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'
import { collectPlugin } from './scripts/collect-plugin'
import { loadConfig } from './scripts/lib/config'
import { setupPlugin } from './scripts/setup-plugin'

// envDir: false desliga o load/restart automático do Vite no .env (o setup
// grava token/reposRoot COM o servidor rodando); loadConfig() também garante o
// .env criado do .env.example já no boot do dev server
loadConfig()

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
    // pré-compila os catálogos JSON de src/locales; include restrito pra não
    // tocar nos demais JSONs do app. module 'petite-vue-i18n': sem isso o
    // plugin injeta um alias vue-i18n→dist runtime que colide com o nosso;
    // dropMessageCompiler porque TODA mensagem chega pré-compilada daqui
    VueI18nPlugin({
      // picomatch exige forward slashes — fileURLToPath no Windows devolve
      // backslash e o include não casa (os JSONs passam crus pelo vite:json
      // e, sem compilador em runtime, t() devolve a chave)
      include: [`${fileURLToPath(new URL('./src/locales', import.meta.url)).replaceAll('\\', '/')}/**`],
      module: 'petite-vue-i18n',
      dropMessageCompiler: true,
    }),
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
      // petite-vue-i18n (13,6KB gzip vs 19,3 do vue-i18n full): a API usada
      // aqui (t/interpolação/plural) é subconjunto do petite — migrar pro full
      // depois = remover este alias (imports seguem dizendo 'vue-i18n')
      'vue-i18n': 'petite-vue-i18n',
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    fs: {
      // o dev server serve qualquer arquivo da raiz por padrão — nega os que
      // têm dado pessoal/segredo (os defaults do Vite já cobrem .env/*.pem).
      // '**/data/**' cobre o data/ do banco e dos clones; os JSONs de
      // public/data/ são servidos pelo middleware do collect-plugin.ts
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        'team.local.json',
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
