import ui from '@nuxt/ui/vue-plugin'
import { createApp } from 'vue'
import App from './App.vue'
import { setupI18n } from './i18n'
import { router } from './router'
import './main.css'

// rotas: file-based em src/pages (vue-router/vite) — ver src/router/index.ts
// bootstrap async: o locale resolve e o chunk lazy do idioma carrega ANTES do
// mount — sem flash de idioma; o splash do App.vue cobre a espera
async function bootstrap() {
  const i18n = await setupI18n()
  createApp(App)
    .use(i18n)
    .use(router)
    .use(ui)
    .mount('#app')
}
void bootstrap()
