import type { GraphCommit } from '../types'

/**
 * Leitura do campo `refs` do graph-REPO.json (issue #127): o contrato aceita
 * TANTO o `%d` cru do git ("(HEAD -> main, tag: v1.0)", como o coletor #126
 * emite na 1ª versão) QUANTO o array já parseado (recomendação do spike #125)
 * — seja string, array de strings ou array de objetos, o reader tipa. Se o
 * contrato final do coletor divergir, vale o coletor (PR #126).
 */

export type GraphRefType = 'HEAD' | 'branch' | 'tag' | 'remote'

export interface GraphRef {
  name: string
  type: GraphRefType
}

/** chave estável de um ref (chips e destaque de lane usam ela) */
export function refKey(r: GraphRef): string {
  return `${r.type}:${r.name}`
}

const REF_TYPES: GraphRefType[] = ['HEAD', 'branch', 'tag', 'remote']

function isRefType(value: unknown): value is GraphRefType {
  return typeof value === 'string' && (REF_TYPES as string[]).includes(value)
}

/** classifica um token do %d cru: "HEAD -> x", "tag: v1", "origin/x", "x" */
function classifyToken(token: string): GraphRef | null {
  const t = token.trim()
  if (!t)
    return null
  if (t.startsWith('tag:'))
    return { name: t.slice(4).trim(), type: 'tag' }
  const arrow = t.split('->')
  if (arrow.length === 2) {
    const to = (arrow[1] ?? '').trim()
    if (!to)
      return null
    return (arrow[0] ?? '').trim() === 'HEAD' ? { name: to, type: 'HEAD' } : { name: to, type: 'branch' }
  }
  if (t === 'HEAD')
    return { name: 'HEAD', type: 'HEAD' }
  // ref remoto: prefixo de remote conhecido (os clones do coletor usam origin)
  if (/^origin\//.test(t))
    return { name: t, type: 'remote' }
  return { name: t, type: 'branch' }
}

function normalizeItem(item: unknown): GraphRef | null {
  if (typeof item === 'string')
    return classifyToken(item)
  if (item && typeof item === 'object') {
    const rec = item as { name?: unknown, type?: unknown }
    if (typeof rec.name !== 'string' || !rec.name)
      return null
    if (isRefType(rec.type))
      return { name: rec.name, type: rec.type }
    return classifyToken(rec.name)
  }
  return null
}

/** `refs` do GraphCommit → lista tipada (vazio/ausente → []) */
export function parseRefs(refs: GraphCommit['refs']): GraphRef[] {
  if (!refs)
    return []
  if (Array.isArray(refs))
    return refs.map(normalizeItem).filter((r): r is GraphRef => r !== null)
  let raw = String(refs).trim()
  if (raw.startsWith('(') && raw.endsWith(')'))
    raw = raw.slice(1, -1)
  if (!raw)
    return []
  return raw.split(',').map(classifyToken).filter((r): r is GraphRef => r !== null)
}
