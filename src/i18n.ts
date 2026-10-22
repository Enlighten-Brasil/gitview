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
 * Contrato com a #253 (format.ts locale-aware): este módulo É o elo
 * bootstrap→format.ts. setupI18n chama setFormatLocale com o locale efetivo
 * (inclusive o default quando o chunk lazy falha) e applyLocale repete a
 * chamada em toda troca de locale já carregado — format.ts continua sem
 * importar este módulo (scripts/check-report.ts o importa em Node puro — por
 * isso o createI18n é um import DINÂMICO dentro do setupI18n, nunca estático).
 */
import { setFormatLocale } from './format'
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

type I18nInstance = Awaited<ReturnType<typeof setupI18n>>

/** composer global criado pelo setupI18n — null enquanto o bootstrap não roda */
let globalComposer: I18nInstance['global'] | null = null

/**
 * Cria a instância já com as mensagens do locale resolvido (await no main.ts).
 * Falha no chunk lazy → warn + pt-BR, sem derrubar a UI.
 * `load` injetável só pra teste (probe de falha de chunk).
 */
export async function setupI18n(
  locale: Locale = detectLocale(),
  load: Record<string, LocaleLoader> = lazyLoaders,
) {
  // 'vue-i18n' via import dinâmico: a cadeia Node (scripts/check-report.ts →
  // src/data → filters → este módulo) roda em tsx puro sem o alias do Vite e
  // morreria resolvendo o pacote — só o bootstrap assíncrono importa o motor
  const { createI18n } = await import('vue-i18n')
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
      applyLocale(i18n, locale)
    }
    catch (err) {
      console.warn(`[i18n] falha ao carregar o locale '${locale}' — usando ${DEFAULT_LOCALE}`, err)
    }
  }
  // fiação bootstrap→format.ts (#255): o formato acompanha o locale EFETIVO,
  // inclusive o default quando o chunk lazy falhou no catch acima
  setFormatLocale(i18n.global.locale.value)
  globalComposer = i18n.global
  return i18n
}

/**
 * composer global do setupI18n, pra consumo fora de componente (rangeLabel em
 * src/filters.ts). Erro de programa: consultaram antes do bootstrap.
 */
export function getComposer(): I18nInstance['global'] {
  if (globalComposer == null)
    throw new Error('[i18n] setupI18n ainda não rodou — getComposer chamado antes do bootstrap')
  return globalComposer
}

/**
 * Slot do seletor de idioma (o seletor em si é da #264): troca o locale de uma
 * instância JÁ carregada, persiste a chave 'gitview:lang' no localStorage
 * (storage pode estar bloqueado → try/catch) e acompanha o format.ts.
 * O carregamento do chunk lazy continua sendo responsabilidade do chamador —
 * o seletor da #264 carrega as mensagens antes de chamar aqui.
 */
export function applyLocale(i18n: I18nInstance, locale: Locale): void {
  i18n.global.locale.value = locale
  try {
    localStorage.setItem('gitview:lang', locale)
  }
  catch {
    // storage bloqueado (modo privado/política) — a troca vale só nesta sessão
  }
  setFormatLocale(locale)
}
