/**
 * Formatação unificada (issue #32) — única fonte dos formatadores de
 * número, data e duração do frontend. Antes cada componente/página tinha os
 * seus (`fmt` com 4 comportamentos, `fmtDate` com 6 assinaturas, cópias de
 * diferença de dias em 6+ lugares, `median`/`fmtDuration` presos em github.ts).
 * No locale default (pt-BR) a vírgula é o separador decimal em TODO formato
 * com casas decimais.
 *
 * i18n (issue #253): o locale é ESTADO DE MÓDULO com default 'pt-BR'
 * (byte-idêntico ao comportamento original) e toda função aceita um `locale`
 * explícito que vence o estado. `setFormatLocale` será ligado pelo bootstrap
 * do motor de i18n na onda 2 (#255) — format.ts NUNCA importa o motor
 * (vue-i18n/petite) porque scripts/check-report.ts o importa em Node puro.
 * As tabelas de palavras/unidades ficam AQUI (decisão: o formatador é a única
 * fonte de número/data/duração), não em src/locales.
 */

const DAY_MS = 86_400_000
const DEFAULT_LOCALE = 'pt-BR'

let moduleLocale = DEFAULT_LOCALE

/**
 * define o locale global dos formatadores (bootstrap do i18n chama na onda 2).
 * Identificador malformado (o Intl rejeita) é ignorado com warn — o locale
 * anterior segue valendo em vez de quebrar o render num fmt* posterior
 */
export function setFormatLocale(locale: string): void {
  try {
    Intl.DateTimeFormat.supportedLocalesOf([locale])
    moduleLocale = locale
  }
  catch {
    console.warn(`[format] locale malformado '${locale}' — mantendo '${moduleLocale}'`)
  }
}

/** locale efetivo: o parâmetro explícito vence o estado de módulo */
function resolveLocale(locale?: string): string {
  return locale ?? moduleLocale
}

/** tabela por locale com fallback pro default — locale sem entrada degrada, nunca quebra */
function pick<T>(table: Record<string, T>, locale?: string): T {
  return table[resolveLocale(locale)] ?? table[DEFAULT_LOCALE]
}

/** palavras relativas por locale — hoje/ontem/há Nd ↔ today/yesterday/Nd ago */
const RELATIVE_WORDS: Record<string, { today: string, yesterday: string, daysAgo: (days: number) => string }> = {
  'pt-BR': { today: 'hoje', yesterday: 'ontem', daysAgo: d => `há ${d}d` },
  'en-US': { today: 'today', yesterday: 'yesterday', daysAgo: d => `${d}d ago` },
  'es-ES': { today: 'hoy', yesterday: 'ayer', daysAgo: d => `hace ${d}d` },
}

/** sufixos de duração por locale — h/d/sem ↔ h/d/w */
const DURATION_UNITS: Record<string, { h: string, d: string, w: string }> = {
  'pt-BR': { h: 'h', d: 'd', w: 'sem' },
  'en-US': { h: 'h', d: 'd', w: 'w' },
  'es-ES': { h: 'h', d: 'd', w: 'sem' },
}

/** rótulos curtos dos dias da semana (dom=0 … sáb=6) por locale — única fonte do projeto */
const WEEKDAY_NAMES: Record<string, readonly string[]> = {
  'pt-BR': ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'],
  'en-US': ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
  'es-ES': ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
}

function toDate(iso: string | Date): Date {
  return iso instanceof Date ? iso : new Date(iso)
}

/** inteiro com separador de milhar do locale — 1.234.567 (pt-BR) / 1,234,567 (en-US) */
export function fmtInt(n: number, locale?: string): string {
  return n.toLocaleString(resolveLocale(locale))
}

/** compacto — 2,2M / 350k / 1.234 no default pt-BR (separadores seguem o locale) */
export function fmtCompact(n: number, locale?: string): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000)
    return `${fmtRatio(n / 1_000_000, locale)}M`
  if (abs >= 10_000)
    return `${(n / 1_000).toFixed(0)}k`
  return fmtInt(n, locale)
}

/** 1 casa decimal no locale — "1,5" (pt-BR) / "1.5" (en-US) (sufixo fica no chamador: ×, /sem, /mês) */
export function fmtRatio(n: number, locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale), { maximumFractionDigits: 1, minimumFractionDigits: 1, useGrouping: false }).format(n)
}

/** horas -> "<1h" / "18h" / "2,3d" / "1,5sem" (sufixos pela tabela do locale) */
export function fmtDuration(hours: number, locale?: string): string {
  const u = pick(DURATION_UNITS, locale)
  if (hours < 1)
    return `<1${u.h}`
  if (hours < 48)
    return `${Math.round(hours)}${u.h}`
  const days = hours / 24
  if (days < 14)
    return `${fmtRatio(days, locale)}${u.d}`
  return `${fmtRatio(days / 7, locale)}${u.w}`
}

/** data curta (dd/mm/aaaa em pt-BR); "—" sem data */
export function fmtDate(iso: string | Date | null | undefined, locale?: string): string {
  if (iso == null || iso === '')
    return '—'
  return toDate(iso).toLocaleDateString(resolveLocale(locale))
}

/** dia/mês curto (dd/mm em pt-BR) — janelas sem ano, ex.: "13/10 a 19/10" */
export function fmtDay(d: Date, locale?: string): string {
  return d.toLocaleDateString(resolveLocale(locale), { day: '2-digit', month: '2-digit' })
}

/** data + hora (dd/mm/aaaa, hh:mm:ss em pt-BR); "—" sem data */
export function fmtDateTime(iso: string | Date | null | undefined, locale?: string): string {
  if (iso == null || iso === '')
    return '—'
  return toDate(iso).toLocaleString(resolveLocale(locale))
}

/** data + hora sem segundos (dd/mm/aaaa hh:mm em pt-BR); "—" sem data ou data inválida */
export function fmtDateTimeShort(iso: string | Date | null | undefined, locale?: string): string {
  if (iso == null || iso === '')
    return '—'
  const d = toDate(iso)
  if (Number.isNaN(d.getTime()))
    return '—'
  return d.toLocaleString(resolveLocale(locale), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** "hoje" / "ontem" / "há Nd" a partir de uma data (palavras pela tabela do locale) */
export function fmtDaysAgo(iso: string, locale?: string): string {
  const days = daysSince(iso)
  const w = pick(RELATIVE_WORDS, locale)
  if (days <= 0)
    return w.today
  if (days === 1)
    return w.yesterday
  return w.daysAgo(days)
}

/** rótulos curtos dos dias da semana (dom=0 … sáb=6) no locale resolvido */
export function fmtWeekdays(locale?: string): readonly string[] {
  return pick(WEEKDAY_NAMES, locale)
}

/** dias inteiros desde a data até hoje (0 = hoje) */
export function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS)
}

/** mediana (par -> média dos dois centrais; vazio -> 0) */
export function median(arr: number[]): number {
  if (!arr.length)
    return 0
  const s = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}
