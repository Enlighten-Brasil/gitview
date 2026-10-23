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
    // scratch do git filter-branch (#247)
    expect(isExcluded('.git-rewrite/map/0003942ce1f34b0ca039caba21df7e2d5cf40ebb')).toBe(true)
  })

  it('fonte humana nunca cai na lista default', () => {
    expect(isExcluded('src/App.vue')).toBe(false)
    // 'scripts/**' ficou FORA da lista de propósito (conteúdo misto, #236)
    expect(isExcluded('scripts/collect.ts')).toBe(false)
    expect(isExcluded('src/minjs-helpers.ts')).toBe(false)
    expect(isExcluded('docs/getting-started.md')).toBe(false)
    // 'themes/**' e 'content/**' recusados de propósito (conteúdo misto, #247)
    expect(isExcluded('src/assets/themes/candy.ts')).toBe(false)
    expect(isExcluded('content/en/1.docs/1.Getting Started/1.index.md')).toBe(false)
    expect(isExcluded('docs/content/pt-BR/2.core/1.index.md')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Equivalência diff-0 contra o matcher regex legado (#269) — oráculo copiado
// da implementação antiga (só no teste; a produção não tem mais regex)
// ---------------------------------------------------------------------------
function legacyGlob(path: string, pattern: string): boolean {
  const body = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0')
    .replace(/\*/g, '[^/]*')
    .split('\0')
    .join('.*')
  // match(string) converte via RegExpCreate(source, '') — byte-idêntico a
  // new RegExp(source), só sem o construtor dinâmico que a Codacy alerta (#285)
  const source = pattern.includes('/')
    ? `(^|.*/)${body}$`
    : `^${body}$`
  const target = pattern.includes('/') ? path : (path.split('/').pop() ?? path)
  return target.match(source) !== null
}

const EXTRA_PATTERNS = [
  'src/*.ts',
  '*.min.js',
  '?.lock',
  'a**b**c',
  '**/*.ts',
  'dist/',
  'My Dir/*.lock',
  'x/y/**',
  '**',
  '*',
  'a**',
  '**b',
  '.',
  '',
  'a**a**a**az',
]

const CURATED_PATHS = [
  'pnpm-lock.yaml',
  'packages/api/pnpm-lock.yaml',
  'packages/api/pnpm-lock.yaml.bak',
  'apps/web/full_documentation.json',
  'src/appXminXjs',
  'dist/bundle.js',
  'apps/web/dist/bundle.js',
  'documentation/api/index.md',
  'overwrites/npm/pkg/index.js',
  'dist/',
  'app.min.js',
  'assets/vendor/app.min.js',
  'src/util.ts',
  'src/deep/util.ts',
  'src/utils/spec.ts',
  'Dist/bundle.js',
  'a.lock',
  'ab.lock',
  'src/App.vue',
  '.git-rewrite/map/0003942c',
  '.git-rewrite/index',
  'content/en/1.docs/1.Getting Started/1.index.md',
  'docs/content/pt-BR/2.core/1.index.md',
  'src/assets/themes/candy.ts',
  'a\nb',
  'a/b\nc/d',
  'x\ry',
  'q',
  '',
  'a/b/c/d/e/f/g.ts',
  'dist',
  'dist//x',
  'a/dist/b',
]

describe('matchesGlob — tabela-verdade diff-0 vs o regex legado (#269)', () => {
  it('todos os DEFAULT_EXCLUDE_PATHS × caminhos curados', () => {
    for (const pattern of [...DEFAULT_EXCLUDE_PATHS, ...EXTRA_PATTERNS]) {
      for (const path of CURATED_PATHS) {
        expect([path, pattern, matchesGlob(path, pattern)])
          .toEqual([path, pattern, legacyGlob(path, pattern)])
      }
    }
  })

  it('fuzz determinístico de 25.000 pares padrão × caminho', () => {
    // LCG fixo (Numerical Recipes) — determinístico em qualquer máquina
    let seed = 20261023
    const rand = (n: number) => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed % n
    }
    const PTOK = ['a', 'b', 'x', 'z', '/', '.', '*', '**', '\n', '\r', '\u2029']
    const PATHOK = ['a', 'b', 'x', 'z', '/', '.', '\n', '\r', '\u2029', 'q', '*']
    for (let i = 0; i < 25000; i++) {
      let pattern = ''
      const plen = rand(8)
      for (let j = 0; j < plen; j++)
        pattern += PTOK[rand(PTOK.length)]
      let path = ''
      const pathlen = rand(11)
      for (let j = 0; j < pathlen; j++)
        path += PATHOK[rand(PATHOK.length)]
      expect([path, pattern, matchesGlob(path, pattern)])
        .toEqual([path, pattern, legacyGlob(path, pattern)])
    }
  })

  it('quirks preservados: NUL do padrão vira .* e quebra de linha', () => {
    const NUL = String.fromCharCode(0)
    const LS = String.fromCharCode(0x2028)
    expect(matchesGlob('axb', `a${NUL}b`)).toBe(legacyGlob('axb', `a${NUL}b`))
    expect(matchesGlob('axxb', `a${NUL}b`)).toBe(legacyGlob('axxb', `a${NUL}b`))
    // '*' ([^/]* da regex) atravessa quebra de linha; '**' ('.*') também, já
    // que '.' da regex só exclui terminadores — pinado nos dois sentidos
    expect(matchesGlob('a\nb', 'a*b')).toBe(legacyGlob('a\nb', 'a*b'))
    expect(matchesGlob('a\nb', 'a**b')).toBe(legacyGlob('a\nb', 'a**b'))
    expect(matchesGlob(`a${LS}b`, 'a**b')).toBe(legacyGlob(`a${LS}b`, 'a**b'))
    expect(matchesGlob(`a${LS}b`, 'a*b')).toBe(legacyGlob(`a${LS}b`, 'a*b'))
  })
})

describe('matchesGlob — ReDoS eliminado (#269)', () => {
  it('caso **a x25 + z contra path de 80 chars resolve em <50ms (era >15s)', () => {
    const pattern = `${'**a'.repeat(25)}z`
    const path = `${'a'.repeat(79)}!`
    const t0 = performance.now()
    const r = matchesGlob(path, pattern)
    const ms = performance.now() - t0
    expect(r).toBe(false)
    expect(ms).toBeLessThan(50)
  })

  it('padrões dos DEFAULT_EXCLUDE_PATHS seguem casando em massa', () => {
    const t0 = performance.now()
    let hits = 0
    for (let i = 0; i < 50000; i++) {
      const path = `apps/web/dist/bundle-${i}.js`
      if (matchesGlob(path, 'dist/**'))
        hits++
      if (matchesGlob(path, 'pnpm-lock.yaml'))
        hits++
    }
    expect(hits).toBe(50000)
    expect(performance.now() - t0).toBeLessThan(2000)
  })
})
