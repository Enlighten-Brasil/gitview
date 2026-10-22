import type { GraphCommit } from '../src/types'
import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { displayRefName, resolveIntegRefs, resolveIntegRefsAsync, resolveProdRef, resolveProdRefAsync } from '../scripts/lib/refs'
import { parseRefs, refKey } from '../src/graph/refs'
/**
 * lib/refs spawna git (rev-parse/symbolic-ref) e não tem seam de injeção —
 * o node:child_process é stubado aqui para controlar "ref existe" e
 * "symbolic-ref" por cenário, sem git real (CI-safe). O comportamento sob
 * teste é a ORDEM do fallback e a forma do retorno (#141).
 */
const git = vi.hoisted(() => {
  const state = {
    /** refs que "existem" no repo fake (aceita as três formas) */
    refs: new Set<string>(),
    /** ref -> alvo do symbolic-ref (ex.: 'HEAD' -> 'refs/heads/main') */
    symbolic: new Map<string, string>(),
    /** args de cada chamada, na ordem (rev-parse e symbolic-ref) */
    calls: [] as string[][],
  }
  function answer(args: string[]): { status: number, stdout: string } {
    state.calls.push(args)
    if (args.includes('symbolic-ref')) {
      const target = state.symbolic.get(args[args.length - 1])
      return target === undefined ? { status: 1, stdout: '' } : { status: 0, stdout: `${target}\n` }
    }
    const ref = args[args.length - 1].replace(/\^\{commit\}$/, '')
    return state.refs.has(ref) ? { status: 0, stdout: 'deadbeef\n' } : { status: 1, stdout: '' }
  }
  return { ...state, answer }
})

vi.mock('node:child_process', () => ({
  spawnSync: (_cmd: string, args: string[]) => git.answer(args),
  spawn: (_cmd: string, args: string[]) => {
    const { status, stdout } = git.answer(args)
    const dataFns: ((c: Uint8Array) => void)[] = []
    const handlers = new Map<string, (...a: unknown[]) => void>()
    queueMicrotask(() => {
      if (stdout) {
        for (const fn of dataFns) fn(Buffer.from(stdout))
      }
      handlers.get('close')?.(status)
    })
    return {
      stdout: { on: (_e: string, fn: (c: Uint8Array) => void) => dataFns.push(fn) },
      stderr: { on: () => {} },
      on: (event: string, fn: (...a: unknown[]) => void) => { handlers.set(event, fn) },
    }
  },
}))

// cada cenário usa um repoPath distinto: os resolvedores memoizam por processo
beforeEach(() => {
  git.refs.clear()
  git.symbolic.clear()
  git.calls.length = 0
})

describe('displayRefName', () => {
  it('remove as formas longas e origin/ — nome curto para exibição', () => {
    expect(displayRefName('refs/heads/main')).toBe('main')
    expect(displayRefName('refs/remotes/origin/main')).toBe('main')
    expect(displayRefName('origin/main')).toBe('main')
    expect(displayRefName('main')).toBe('main')
  })
})

describe('resolveProdRef (ordem do fallback)', () => {
  it('valor explícito existente vence e devolve a forma curta', () => {
    git.refs.add('release')
    expect(resolveProdRef('/fake/explicito-curto', 'release')).toBe('release')
  })

  it('valor explícito que existe só na remota devolve a forma longa (#141)', () => {
    git.refs.add('refs/remotes/origin/release')
    expect(resolveProdRef('/fake/explicito-remoto', 'release')).toBe('refs/remotes/origin/release')
  })

  it('explícito inexistente: warn 1× nomeando repo e valor, e cai no automático', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    git.symbolic.set('refs/remotes/origin/HEAD', 'refs/remotes/origin/main')
    git.refs.add('refs/remotes/origin/main')
    expect(resolveProdRef('/fake/fallback-originahead', 'producao-que-nao-existe')).toBe('refs/remotes/origin/main')
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain('fallback-originahead')
    expect(warn.mock.calls[0][0]).toContain('producao-que-nao-existe')
    warn.mockRestore()
  })

  it('checkout normal: origin/HEAD vem antes de HEAD, main e master', () => {
    git.symbolic.set('refs/remotes/origin/HEAD', 'refs/remotes/origin/develop')
    git.symbolic.set('HEAD', 'refs/heads/main')
    git.refs.add('refs/remotes/origin/develop')
    git.refs.add('main')
    expect(resolveProdRef('/fake/checkout-normal')).toBe('refs/remotes/origin/develop')
  })

  it('clone bare: sem origin/HEAD, o HEAD simbólico resolve como nome curto', () => {
    git.symbolic.set('HEAD', 'refs/heads/master')
    git.refs.add('master')
    expect(resolveProdRef('/fake/bare')).toBe('master')
  })

  it('detached (sem origin/HEAD e sem HEAD): main antes de master', () => {
    git.refs.add('main')
    git.refs.add('master')
    expect(resolveProdRef('/fake/detached')).toBe('main')
  })

  it('nada resolvível lança erro nomeando o repo e o que foi tentado', () => {
    expect(() => resolveProdRef('/fake/vazio'))
      .toThrow(/vazio: sem ref de produção resolvível.*Tentados: main, master/)
  })

  it('memoiza por (repoPath, config): a segunda chamada não spawna git', () => {
    git.refs.add('main')
    const before = git.calls.length
    expect(resolveProdRef('/fake/memo')).toBe('main')
    const firstBatch = git.calls.length - before
    expect(firstBatch).toBeGreaterThan(0)
    expect(resolveProdRef('/fake/memo')).toBe('main')
    expect(git.calls.length - before).toBe(firstBatch)
  })

  it('resolveProdRefAsync espelha a mesma ordem de fallback (spawn streaming)', async () => {
    git.refs.add('main')
    await expect(resolveProdRefAsync('/fake/async')).resolves.toBe('main')
  })
})

describe('resolveIntegRefs (ordem da lista, vazio é legítimo)', () => {
  it('default [develop, staging] filtrado por existência; sem nada é [], sem warn e sem erro', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(resolveIntegRefs('/fake/integ-nada')).toEqual([])
    git.refs.add('develop')
    expect(resolveIntegRefs('/fake/integ-so-develop')).toEqual(['develop'])
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('respeita a lista explícita na ordem dada, deduplica por nome de exibição e pula vazio', () => {
    git.refs.add('refs/heads/staging')
    git.refs.add('refs/remotes/origin/homolog')
    expect(resolveIntegRefs('/fake/integ-ordem', ['homolog', 'refs/heads/staging', 'staging', '  ', 'release']))
      .toEqual(['refs/remotes/origin/homolog', 'refs/heads/staging'])
  })

  it('lista vazia explícita respeitada; o cache devolve cópia (mutação não contamina)', () => {
    expect(resolveIntegRefs('/fake/integ-vazio-explicito', [])).toEqual([])
    git.refs.add('develop')
    const first = resolveIntegRefs('/fake/integ-copia', ['develop'])
    first.push('extra')
    expect(resolveIntegRefs('/fake/integ-copia', ['develop'])).toEqual(['develop'])
  })

  it('resolveIntegRefsAsync espelha ordem, dedupe e filtragem', async () => {
    git.refs.add('refs/remotes/origin/homolog')
    await expect(resolveIntegRefsAsync('/fake/integ-async', ['homolog', 'staging']))
      .resolves
      .toEqual(['refs/remotes/origin/homolog'])
  })
})

/** Issue #249 — o reader aceita o %d cru do git e o array já parseado (contrato #127). */
describe('parseRefs', () => {
  it('string crua "(HEAD -> main, tag: v1.0)" vira lista tipada', () => {
    expect(parseRefs('(HEAD -> main, tag: v1.0)')).toEqual([
      { name: 'main', type: 'HEAD' },
      { name: 'v1.0', type: 'tag' },
    ])
  })

  it('classifica remoto (origin/), branch simples e HEAD solto', () => {
    expect(parseRefs('(origin/main, feature-x)')).toEqual([
      { name: 'origin/main', type: 'remote' },
      { name: 'feature-x', type: 'branch' },
    ])
    expect(parseRefs('HEAD')).toEqual([{ name: 'HEAD', type: 'HEAD' }])
    expect(parseRefs('(feature -> develop)')).toEqual([{ name: 'develop', type: 'branch' }])
  })

  it('array de strings e de objetos passa pelo mesmo classificador', () => {
    expect(parseRefs(['tag: v2.0', 'origin/dev'])).toEqual([
      { name: 'v2.0', type: 'tag' },
      { name: 'origin/dev', type: 'remote' },
    ])
    expect(parseRefs([
      { name: 'main', type: 'HEAD' },
      { name: 'release', type: 'bogus' },
      { name: '', type: 'branch' },
    ])).toEqual([
      { name: 'main', type: 'HEAD' },
      { name: 'release', type: 'branch' },
    ])
  })

  it('ausente/vazio → lista vazia', () => {
    const bare: GraphCommit = { hash: 'a', parents: [], author: 'x', date: '2026-01-01T00:00:00.000Z', subject: 's' }
    expect(parseRefs(undefined)).toEqual([])
    expect(parseRefs('')).toEqual([])
    expect(parseRefs('()')).toEqual([])
    expect(parseRefs(bare.refs)).toEqual([])
  })

  it('refKey é a chave estável usada por chips e destaque', () => {
    expect(refKey({ name: 'main', type: 'branch' })).toBe('branch:main')
  })
})
