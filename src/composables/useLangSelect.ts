import type { Locale } from '../i18n'
import { useI18n } from 'vue-i18n'
import { applyLocale, getComposer, getI18n, loadChunk, SUPPORTED_LOCALES } from '../i18n'

// trocas em sequência: token monótono descarta load que ficou obsoleto
let switchSeq = 0

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
  const seq = ++switchSeq
  try {
    await loadChunk(getComposer(), next)
  }
  catch (err) {
    // chunk falhou: locale ATUAL preservado (applyLocale só roda no sucesso)
    console.warn(`[i18n] falha ao carregar o chunk do locale '${next}' — mantendo o idioma atual`, err)
    return
  }
  // outra troca mais nova assumiu enquanto o chunk carregava: descarta esta
  if (seq !== switchSeq)
    return
  applyLocale(i18n, next)
}

export function useLangSelect() {
  const { locale } = useI18n({ useScope: 'global' })
  /** valor vem do evento do DOM — só segue se for locale suportado */
  async function choose(next: string): Promise<void> {
    const hit = SUPPORTED_LOCALES.find(l => l === next)
    if (!hit)
      return
    try {
      await switchLang(hit)
    }
    catch (err) {
      // switchLang já engole falha de chunk; aqui protege o event handler
      // contra erro de programa (ex.: bootstrap ausente) sem derrubar a UI
      console.warn('[i18n] falha ao trocar o idioma', err)
    }
  }
  return { locale, choose }
}
