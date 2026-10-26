import { getComposerIfReady } from './i18n'
import ptReport from './locales/pt-BR/report.json'

export interface ReportValues {
  [name: string]: string | number
}

type ReportCatalogKey = keyof typeof ptReport
type PluralBase<Key> = Key extends `${infer key}.one` ? key : never
type ReportPluralKey = PluralBase<ReportCatalogKey>
type ReportPluralCatalogKey = `${ReportPluralKey}.one` | `${ReportPluralKey}.other`
type ReportStaticKey = Exclude<ReportCatalogKey, `${string}.one` | `${string}.other`>

const ptMessages = new Map<string, string>(Object.entries(ptReport))

function nodeMessage(key: ReportCatalogKey): string {
  const message = ptMessages.get(key)
  if (message === undefined)
    throw new Error(`[report-i18n] chave ausente no catálogo pt-BR: ${String(key)}`)
  return message
}

function interpolate(message: string, values: ReportValues): string {
  let result = message
  for (const [name, value] of Object.entries(values))
    result = result.replaceAll(`{${name}}`, String(value))
  return result
}

/** Copy do motor: composer ativo no browser; catálogo pt-BR direto em Node. */
export function reportT(key: ReportStaticKey, values: ReportValues = {}): string {
  const composer = getComposerIfReady()
  if (composer)
    return composer.t(key, values)
  return interpolate(nodeMessage(key), values)
}

/** Plurais .one/.other por Intl.PluralRules, sem parser de pipe nem concatenação de variantes. */
export function reportPlural(key: ReportPluralKey, count: number, values: ReportValues = {}): string {
  const composer = getComposerIfReady()
  const locale = composer?.locale.value ?? 'pt-BR'
  // pt-BR legado concorda zero no plural; o CLDR o classifica como `one`.
  const category = count === 0 ? 'other' : new Intl.PluralRules(locale).select(count)
  const variant = category === 'one' ? 'one' : 'other'
  const messageKey = `${String(key)}.${variant}` as ReportPluralCatalogKey
  const params = { ...values, count }
  if (composer)
    return composer.t(messageKey, params)
  return interpolate(nodeMessage(messageKey), params)
}
