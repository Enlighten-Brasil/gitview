import type { Router } from 'vue-router'

/**
 * Scroll: o conteúdo rola dentro do body do UDashboardPanel (overflow-y-auto),
 * não na janela — o scrollBehavior do router (window.scrollTo) não faz nada aqui.
 */
export function setupScroll(router: Router): void {
  router.afterEach((to, from) => {
    if (to.hash) {
      // conteúdo async: espera o anchor existir e rola o container até ele;
      // re-rola depois porque os gráficos ECharts renderizam atrasado e empurram
      // o layout pra baixo
      let attempts = 0
      const scroll = () => document.querySelector(to.hash)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const find = () => {
        if (document.querySelector(to.hash)) {
          scroll()
          setTimeout(scroll, 500)
          setTimeout(scroll, 1500)
        }
        else if (++attempts < 50) {
          setTimeout(find, 100)
        }
      }
      find()
    }
    else if (to.path !== from.path) {
      document.querySelector<HTMLElement>('.overflow-y-auto')?.scrollTo({ top: 0 })
    }
  })
}
