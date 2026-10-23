import type { Locale } from '../i18n'
import { useI18n } from 'vue-i18n'
import { applyLocale, getComposer, getI18n, loadChunk, SUPPORTED_LOCALES } from '../i18n'

/**
 * Lógica do seletor de idioma (issue #264): o ESTADO vem de i18n.global.locale
 * (a detecção de 1º acesso continua no detectLocale do boot — aqui só se
 * exibe/escolhe) e a TROCA carrega o chunk lazy ANTES de chamar applyLocale
 * (#255) — persistir 'gitview:lang' e acionar o format.ts é dele, nunca daqui.
 * `switchLang` não depende de contexto de componente pra rodar em teste node.
 */
export async function switchLang(next: Locale): Promise<void> {
  const i18n = getI18n()
  // mesmo locale já ativo: sem chunk novo e sem persistir de novo
  if (next === i18n.global.locale.value)
    return
  await loadChunk(getComposer(), next)
  applyLocale(i18n, next)
}

export function useLangSelect() {
  const { locale } = useI18n({ useScope: 'global' })
  /** valor vem do evento do DOM — só segue se for locale suportado */
  async function choose(next: string): Promise<void> {
    const hit = SUPPORTED_LOCALES.find(l => l === next)
    if (hit)
      await switchLang(hit)
  }
  return { locale, choose }
}
