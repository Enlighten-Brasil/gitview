/**
 * Formatação pt-BR unificada (issue #32) — única fonte dos formatadores de
 * número, data e duração do frontend. Antes cada componente/página tinha os
 * seus (`fmt` com 4 comportamentos, `fmtDate` com 6 assinaturas, cópias de
 * diferença de dias em 6+ lugares, `median`/`fmtDuration` presos em github.ts).
 * Vírgula é o separador decimal em TODO formato com casas decimais.
 */

const DAY_MS = 86_400_000

function toDate(iso: string | Date): Date {
  return iso instanceof Date ? iso : new Date(iso)
}

/** inteiro com separador de milhar pt-BR — 1.234.567 */
export function fmtInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

/** compacto pt-BR — 2,2M / 350k / 1.234 (vírgula decimal) */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 10_000)
    return `${(n / 1_000).toFixed(0)}k`
  return fmtInt(n)
}

/** 1 casa decimal com vírgula — "1,5" (sufixo fica no chamador: ×, /sem, /mês) */
export function fmtRatio(n: number): string {
  return n.toFixed(1).replace('.', ',')
}

/** horas -> "<1h" / "18h" / "2,3d" / "1,5sem" */
export function fmtDuration(hours: number): string {
  if (hours < 1)
    return '<1h'
  if (hours < 48)
    return `${Math.round(hours)}h`
  const days = hours / 24
  if (days < 14)
    return `${fmtRatio(days)}d`
  return `${fmtRatio(days / 7)}sem`
}

/** data curta pt-BR (dd/mm/aaaa); "—" sem data */
export function fmtDate(iso: string | Date | null | undefined): string {
  if (iso == null || iso === '')
    return '—'
  return toDate(iso).toLocaleDateString('pt-BR')
}

/** dia/mês curto (dd/mm) — janelas sem ano, ex.: "13/10 a 19/10" */
export function fmtDay(d: Date): string {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** data + hora pt-BR (dd/mm/aaaa, hh:mm:ss); "—" sem data */
export function fmtDateTime(iso: string | Date | null | undefined): string {
  if (iso == null || iso === '')
    return '—'
  return toDate(iso).toLocaleString('pt-BR')
}

/** "hoje" / "ontem" / "há Nd" a partir de uma data */
export function fmtDaysAgo(iso: string): string {
  const days = daysSince(iso)
  if (days <= 0)
    return 'hoje'
  if (days === 1)
    return 'ontem'
  return `há ${days}d`
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
