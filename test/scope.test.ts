import { Buffer } from 'node:buffer'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { collectScopeSets } from '../scripts/lib/scope'

/**
 * lib/scope: os resolvedores de refs são mockados (devolvem valores fixos) e o
 * spawn do git é stubado com saída canônica — sem git real (CI-safe). Sob
 * teste: construção dos args (um único `--not` no walk — bug medido no
 * cabeçalho do módulo), parsing do par hash/ref, vitória da primeira ref de
 * integração e o strip de refs/heads/ no %S.
 */
const git = vi.hoisted(() => {
  const state = {
    calls: [] as string[][],
    respond: (_args: string[]) => ({ status: 0, stdout: '', stderr: '' }),
  }
  return state
})

// resolvedores controláveis por cenário (o seam real não tem injeção)
const mocks = vi.hoisted(() => ({
  prodRef: 'refs/heads/main',
  integRefs: ['refs/heads/develop', 'refs/heads/staging'] as string[],
}))

vi.mock('../scripts/lib/refs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../scripts/lib/refs')>()
  return {
    ...actual, // displayRefName continua o real (#141)
    resolveProdRefAsync: async () => mocks.prodRef,
    resolveIntegRefsAsync: async () => [...mocks.integRefs],
  }
})

vi.mock('node:child_process', () => ({
  spawnSync: () => { throw new Error('lib/scope não usa spawnSync') },
  spawn: (_cmd: string, args: string[]) => {
    git.calls.push(args)
    const { status, stdout, stderr } = git.respond(args)
    const stdoutFns: ((c: Uint8Array) => void)[] = []
    const stderrFns: ((c: Uint8Array) => void)[] = []
    const handlers = new Map<string, (...a: unknown[]) => void>()
    queueMicrotask(() => {
      if (stdout) {
        for (const fn of stdoutFns) fn(Buffer.from(stdout))
      }
      if (stderr) {
        for (const fn of stderrFns) fn(Buffer.from(stderr))
      }
      handlers.get('close')?.(status)
    })
    return {
      stdout: { on: (_e: string, fn: (c: Uint8Array) => void) => stdoutFns.push(fn) },
      stderr: { on: (_e: string, fn: (c: Uint8Array) => void) => stderrFns.push(fn) },
      on: (event: string, fn: (...a: unknown[]) => void) => { handlers.set(event, fn) },
    }
  },
}))

const WALK = [
  'h-b1 refs/heads/feature-x',
  'h-b2 refs/heads/outra',
  'linha-sem-espaco', // par malformado: sem hash/ref, não vira hint
  'h-b3 ', // ref vazia após trim: não vira hint
  '',
].join('\n')

function respondPadrao(args: string[]): { status: number, stdout: string, stderr: string } {
  if (args[2] === 'rev-list') {
    if (args[3] === 'refs/heads/main')
      return { status: 0, stdout: 'h-p1\nh-p2\n', stderr: '' }
    if (args[3] === 'refs/heads/develop')
      return { status: 0, stdout: 'h-d1\nh-shared\n', stderr: '' }
    return { status: 0, stdout: 'h-s1\nh-shared\n', stderr: '' } // staging
  }
  return { status: 0, stdout: WALK, stderr: '' } // log escoteado
}

beforeEach(() => {
  mocks.prodRef = 'refs/heads/main'
  mocks.integRefs = ['refs/heads/develop', 'refs/heads/staging']
  git.calls.length = 0
  git.respond = respondPadrao
})

describe('collectScopeSets', () => {
  it('monta os args: rev-list por ref com `--not prod` e UM único `--not` no walk escoteado', async () => {
    await collectScopeSets('/fake/scope')
    expect(git.calls).toEqual([
      ['-C', '/fake/scope', 'rev-list', 'refs/heads/main'],
      ['-C', '/fake/scope', 'rev-list', 'refs/heads/develop', '--not', 'refs/heads/main'],
      ['-C', '/fake/scope', 'rev-list', 'refs/heads/staging', '--not', 'refs/heads/main'],
      ['-C', '/fake/scope', 'log', '--branches', '--not', 'refs/heads/main', 'refs/heads/develop', 'refs/heads/staging', '--source', '--no-merges', '--pretty=format:%H %S'],
    ])
  })

  it('monta os sets: prod completo, integ com a PRIMEIRA ref da ordem vencendo, hints com strip de refs/heads/', async () => {
    const sets = await collectScopeSets('/fake/scope')
    expect(sets.prodRef).toBe('main') // displayRefName do resolvedor (#141)
    expect(sets.prod).toEqual(new Set(['h-p1', 'h-p2']))
    expect(sets.integ).toEqual(new Map([
      ['h-d1', 'develop'],
      ['h-shared', 'develop'], // develop veio antes de staging na ordem da config
      ['h-s1', 'staging'],
    ]))
    expect(sets.hints).toEqual(new Map([
      ['h-b1', 'feature-x'],
      ['h-b2', 'outra'],
    ]))
  })

  it('sem refs de integração: map integ vazio, walk só com `--not prod` e forma longa nos comandos', async () => {
    mocks.prodRef = 'refs/remotes/origin/main'
    mocks.integRefs = []
    const sets = await collectScopeSets('/fake/scope')
    expect(sets.prodRef).toBe('main')
    expect(sets.integ.size).toBe(0)
    expect(git.calls[0]).toEqual(['-C', '/fake/scope', 'rev-list', 'refs/remotes/origin/main'])
    expect(git.calls[1]).toEqual([
      '-C',
      '/fake/scope',
      'log',
      '--branches',
      '--not',
      'refs/remotes/origin/main',
      '--source',
      '--no-merges',
      '--pretty=format:%H %S',
    ])
  })

  it('falha de git rejeita com o comando e o repo na mensagem', async () => {
    git.respond = () => ({ status: 128, stdout: '', stderr: 'fatal: bad repo' })
    await expect(collectScopeSets('/fake/quebrado')).rejects.toThrow(/git rev-list falhou em .*quebrado.*fatal: bad repo/)
  })
})
