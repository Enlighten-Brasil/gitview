import { describe, expect, it } from 'vitest'
import { DEFAULT_EXCLUDE_PATHS, matchesGlob } from '../scripts/lib/config'

/**
 * matchesGlob mora em lib/config.ts desde a extração da issue #250 — era
 * privada de scripts/collect.ts, que auto-executa main() no import (testável
 * só depois de mover para ao lado de DEFAULT_EXCLUDE_PATHS). Regex pura: sem
 * rede, sem git, sem fs. Os casos críticos são os que já quebraram produção
 * (#209/#236): literal com barra final e basename vs caminho completo.
 */
describe('matchesGlob', () => {
  it('padrão sem "/" casa o basename em qualquer profundidade', () => {
    expect(matchesGlob('pnpm-lock.yaml', 'pnpm-lock.yaml')).toBe(true)
    expect(matchesGlob('packages/api/pnpm-lock.yaml', 'pnpm-lock.yaml')).toBe(true)
    expect(matchesGlob('apps/web/full_documentation.json', 'full_documentation.json')).toBe(true)
  })

  it('sufixo que NÃO casa: o padrão sem "/" ancora o basename inteiro', () => {
    // mesma classe de erro do 'dist/' da #236: um literal que "quase" casa e
    // silencia a exclusão — pnpm-lock.yaml.bak é arquivo de backup, não lockfile
    expect(matchesGlob('packages/api/pnpm-lock.yaml.bak', 'pnpm-lock.yaml')).toBe(false)
    expect(matchesGlob('src/appXminXjs', '*.min.js')).toBe(false)
  })

  it('padrão com "/" casa o caminho todo, em qualquer profundidade (**)', () => {
    expect(matchesGlob('dist/bundle.js', 'dist/**')).toBe(true)
    expect(matchesGlob('apps/web/dist/bundle.js', 'dist/**')).toBe(true)
    expect(matchesGlob('documentation/api/index.md', 'documentation/**')).toBe(true)
    expect(matchesGlob('overwrites/npm/pkg/index.js', 'overwrites/**')).toBe(true)
  })

  it('lição da #236: \'dist/\' (literal com barra final) NÃO casa os arquivos dentro — por isso a lista default usa \'dist/**\'', () => {
    expect(matchesGlob('dist/bundle.js', 'dist/')).toBe(false)
    expect(matchesGlob('apps/web/dist/bundle.js', 'dist/')).toBe(false)
    expect(matchesGlob('dist/bundle.js', 'dist/**')).toBe(true)
    // só a string literal 'dist/' casa o padrão 'dist/' — nenhum caminho de
    // arquivo real termina em '/', por isso o literal não excluía nada
    expect(matchesGlob('dist/', 'dist/')).toBe(true)
  })

  it('\'*\' casa dentro do segmento e NÃO atravessa \'/\'', () => {
    expect(matchesGlob('app.min.js', '*.min.js')).toBe(true)
    expect(matchesGlob('assets/vendor/app.min.js', '*.min.js')).toBe(true) // casa pelo basename
    expect(matchesGlob('src/util.ts', 'src/*.ts')).toBe(true)
    expect(matchesGlob('src/deep/util.ts', 'src/*.ts')).toBe(false)
    expect(matchesGlob('src/utils/spec.ts', 'src/*.ts')).toBe(false)
  })

  it('case-sensitive como gitignore; metacaracteres escapados', () => {
    expect(matchesGlob('Dist/bundle.js', 'dist/**')).toBe(false)
    // '?' é LITERAL nesta dialect: sem o escape (follow-up #12) viraria
    // quantifier de regex e o glob '?.lock' sub-excluiria em silêncio
    expect(matchesGlob('?.lock', '?.lock')).toBe(true)
    expect(matchesGlob('a.lock', '?.lock')).toBe(false)
    expect(matchesGlob('ab.lock', '?.lock')).toBe(false)
    // '.' é literal, não "qualquer caractere"
    expect(matchesGlob('app-min-js', '*.min.js')).toBe(false)
  })
})

/** espelho do isExcludedPath privado do collect: a lista default aplicada a caminhos representativos */
const isExcluded = (path: string) => DEFAULT_EXCLUDE_PATHS.some(p => matchesGlob(path, p))

describe('lista default de exclusões (DEFAULT_EXCLUDE_PATHS)', () => {
  it('contém \'dist/**\' e NÃO \'dist/\' — regressão da #209/#236', () => {
    expect(DEFAULT_EXCLUDE_PATHS).toContain('dist/**')
    expect(DEFAULT_EXCLUDE_PATHS).not.toContain('dist/')
  })

  it('exclui lockfiles e gerados por basename (qualquer profundidade) e artefatos por caminho', () => {
    expect(isExcluded('pnpm-lock.yaml')).toBe(true)
    expect(isExcluded('packages/api/yarn.lock')).toBe(true)
    expect(isExcluded('assets/app.min.css')).toBe(true)
    expect(isExcluded('src/gen/snapshot.generated.ts')).toBe(true)
    expect(isExcluded('schemas/export.apidog.json')).toBe(true)
    expect(isExcluded('full_documentation.json')).toBe(true)
    expect(isExcluded('apps/web/dist/assets/vendor.js')).toBe(true)
  })

  it('fonte humana nunca cai na lista default', () => {
    expect(isExcluded('src/App.vue')).toBe(false)
    // 'scripts/**' ficou FORA da lista de propósito (conteúdo misto, #236)
    expect(isExcluded('scripts/collect.ts')).toBe(false)
    expect(isExcluded('src/minjs-helpers.ts')).toBe(false)
    expect(isExcluded('docs/getting-started.md')).toBe(false)
  })
})
