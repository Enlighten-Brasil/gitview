/**
 * Aritmética de semana ISO (issue #41) — funções puras, sem dependência do
 * store. Antes viviam no meio do data.ts junto do store de filtros e das
 * agregações de negócio. Chaves no formato "YYYY-Www" (segunda a domingo).
 */

/** chave ISO "YYYY-Www" (segunda a domingo) — usada também pelo resumo semanal */
export function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const fday = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3)
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 864e5))
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** segunda UTC da semana ISO "YYYY-Www" (inverso de isoWeekKey; null se o formato não bate) */
export function isoWeekMonday(key: string): Date | null {
  const m = /^(\d{4})-W(\d{2})$/.exec(key)
  if (!m)
    return null
  const jan4 = new Date(Date.UTC(Number(m[1]), 0, 4))
  const dayNum = (jan4.getUTCDay() + 6) % 7 // 0 = segunda
  const monday = new Date(jan4)
  monday.setUTCDate(jan4.getUTCDate() - dayNum + (Number(m[2]) - 1) * 7)
  return monday
}

/**
 * chave da semana ISO `n` semanas calendário antes de `key` — aritmética pura
 * (não depende de a semana ter dados). Usada por janelas de baseline: semanas
 * vazias contam como 0 em vez de esticar a janela além das N calendárias.
 */
export function isoWeekKeyBefore(key: string, n: number): string | null {
  const monday = isoWeekMonday(key)
  if (!monday)
    return null
  monday.setUTCDate(monday.getUTCDate() - n * 7)
  return isoWeekKey(monday)
}

/** chaves das últimas `n` semanas ISO (a partir de hoje) — janelas fixas de ritmo/burnout */
export function lastNWeekKeys(n: number): string[] {
  const keys: string[] = []
  const d = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const back = new Date(d)
    back.setDate(back.getDate() - i * 7)
    keys.push(isoWeekKey(back))
  }
  return [...new Set(keys)]
}
