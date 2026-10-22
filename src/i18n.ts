/**
 * Motor de i18n (issue #252): petite-vue-i18n + catálogo por namespace em
 * src/locales/<locale>/ (um JSON por namespace; chaves FLAT com prefixo —
 * o resolver default do vue-i18n v11 não expande dot-path). pt-BR é EAGER
 * (default + fallback, entra no bundle); en-US/es-ES são LAZY (import() →
 * chunk por locale, baixado só quando usado).
 *
 * O locale resolve ANTES do mount (main.ts aguarda setupI18n): localStorage
 * 'gitview:lang' → navigator.languages por prefixo → default pt-BR.
 *
 * Contrato com a #253 (format.ts locale-aware): este módulo NÃO importa o
 * format.ts nem chama setter de locale dele — a fiação bootstrap→format.ts
 * é follow-up da onda 2 (#255).
 */
import { createI18n } from 'vue-i18n'
import ptBR from './locales/pt-BR'

export const SUPPORTED_LOCALES = ['pt-BR', 'en-US', 'es-ES'] as const
export type Locale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'pt-BR'

/** prefixo de língua → locale (pt→pt-BR, en→en-US, es→es-ES) — Map: lookup via .get, sem object-injection */
const PREFIX = new Map<string, Locale>([['en', 'en-US'], ['es', 'es-ES'], ['pt', 'pt-BR']])

/** casa uma tag BCP-47 com os locales suportados: exato (case-insensitive) ou por prefixo */
export function matchLocale(tag: string): Locale | null {
  const norm = tag.trim().toLowerCase()
  if (!norm)
    return null
  // exato primeiro (normaliza o case BCP-47: pt-br → pt-BR)…
  const exact = SUPPORTED_LOCALES.find(l => l.toLowerCase() === norm)
  if (exact !== undefined)
    return exact
  // …depois o lookup nullable por prefixo de língua
  return PREFIX.get(norm.split('-')[0]) ?? null
}

/** ordem de preferência: localStorage salvo → lista do navegador → default */
export function pickLocale(saved: string | null, languages: readonly string[]): Locale {
  if (saved) {
    const hit = matchLocale(saved)
    if (hit)
      return hit
  }
  for (const lang of languages) {
    const hit = matchLocale(lang)
    if (hit)
      return hit
  }
  return DEFAULT_LOCALE
}

type Messages = typeof ptBR
type LocaleLoader = () => Promise<{ default: Messages }>

// chunks por locale: cada index.ts de locale vira um entry de import()
// separado; os JSONs do namespace entram inlined no chunk do locale
const lazyLoaders: Record<Exclude<Locale, typeof DEFAULT_LOCALE>, LocaleLoader> = {
  'en-US': () => import('./locales/en-US'),
  'es-ES': () => import('./locales/es-ES'),
}

function detectLocale(): Locale {
  let saved: string | null = null
  try {
    saved = localStorage.getItem('gitview:lang')
  }
  catch {
    // storage bloqueado (modo privado/política) — segue pro navigator
  }
  // navigator.languages é não-nulo nos tipos, mas webviews antigas podem não
  // tê-lo em runtime — modelado explicitamente, sem o fallback inalcançável
  // em navigator.language que o Codacy marcava
  const langs: readonly string[] = typeof navigator === 'undefined' || !Array.isArray(navigator.languages)
    ? []
    : navigator.languages
  return pickLocale(saved, langs)
}

/**
 * Cria a instância já com as mensagens do locale resolvido (await no main.ts).
 * Falha no chunk lazy → warn + pt-BR, sem derrubar a UI.
 * `load` injetável só pra teste (probe de falha de chunk).
 */
export async function setupI18n(
  locale: Locale = detectLocale(),
  load: Record<string, LocaleLoader> = lazyLoaders,
) {
  const i18n = createI18n({
    legacy: false,
    locale: DEFAULT_LOCALE,
    fallbackLocale: DEFAULT_LOCALE,
    messages: { [DEFAULT_LOCALE]: ptBR },
  })
  if (locale !== DEFAULT_LOCALE) {
    try {
      // branches estáticos por locale (Codacy): chaves literais — o Vite gera
      // os chunks por locale; o `load` injetável segue cobrindo os testes
      const loader = locale === 'en-US' ? load['en-US'] : load['es-ES']
      i18n.global.setLocaleMessage(locale, (await loader()).default)
      i18n.global.locale.value = locale
    }
    catch (err) {
      console.warn(`[i18n] falha ao carregar o locale '${locale}' — usando ${DEFAULT_LOCALE}`, err)
    }
  }
  return i18n
}
