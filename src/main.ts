import ui from '@nuxt/ui/vue-plugin'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './main.css'

// rotas: file-based em src/pages (vue-router/vite) — ver src/router/index.ts
createApp(App)
  .use(router)
  .use(ui)
  .mount('#app')
