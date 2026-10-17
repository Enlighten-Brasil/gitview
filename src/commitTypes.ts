/**
 * Categorias de commit + cores compartilhadas (issue #36): antes os dois
 * gráficos de tipos (CommitTypes.vue e repos/[name].vue) definiam a lista e a
 * paleta cada um, e já divergiam em manutenção. Única fonte dos tipos
 * exibidos — docs/test/perf/style/build/ci caem em "outros".
 */
import { ct } from './chartTheme'

export const COMMIT_TYPES = ['feat', 'fix', 'refactor', 'chore', 'outros'] as const

export type CommitType = (typeof COMMIT_TYPES)[number]

/** agrupa o tipo do commit na categoria exibida (tipos fora da lista viram "outros") */
export function commitTypeGroup(type: string): CommitType {
  return (COMMIT_TYPES as readonly string[]).includes(type) ? type as CommitType : 'outros'
}

/** cor da categoria nos gráficos (tokens do tema, resolvidos via `ct`) */
export function commitTypeColor(type: string): string {
  switch (commitTypeGroup(type)) {
    case 'feat':
      return ct.primary
    case 'fix':
      return ct.error500
    case 'refactor':
      return ct.violet500
    case 'chore':
      return ct.warning500
    default:
      return ct.textDim
  }
}
