import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'
import { collectPlugin } from './scripts/collect-plugin'
import { setupPlugin } from './scripts/setup-plugin'

export default defineConfig({
  base: './',
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
    port: 5173,
  },
})
