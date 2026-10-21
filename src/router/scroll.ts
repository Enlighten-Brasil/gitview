import type { Router } from 'vue-router'

/**
 * Scroll: o conteúdo rola dentro do body do UDashboardPanel (overflow-y-auto),
 * não na janela — o scrollBehavior do router (window.scrollTo) não faz nada aqui.
 */
export function setupScroll(router: Router): void {
  // escopo por navegação: os timers da navegação anterior são cancelados no
  // afterEach seguinte, senão polls/re-scrolls stale seguem rolando por ~5s e
  // podem acertar o mesmo id na rota nova
  let pending: ReturnType<typeof setTimeout>[] = []
  router.afterEach((to, from) => {
    pending.forEach(clearTimeout)
    pending = []
    if (to.hash) {
      // conteúdo async: espera o anchor existir e rola o container até ele;
      // re-rola depois porque os gráficos ECharts renderizam atrasado e empurram
      // o layout pra baixo
      const later = (fn: () => void, ms: number) => pending.push(setTimeout(fn, ms))
      let attempts = 0
      const scroll = () => document.querySelector(to.hash)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      const find = () => {
        if (document.querySelector(to.hash)) {
          scroll()
          later(scroll, 500)
          later(scroll, 1500)
        }
        else if (++attempts < 50) {
          later(find, 100)
        }
      }
      find()
    }
    else if (to.path !== from.path) {
      document.querySelector<HTMLElement>('.overflow-y-auto')?.scrollTo({ top: 0 })
    }
  })
}
