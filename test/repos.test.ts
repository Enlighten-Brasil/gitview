import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { discoverRepos, gitAuthEnv, isGitRepo, isManagedRepo, MANAGED_REPOS_DIR, mapPool, parseGitHub, resolveReposRootSafe } from '../scripts/lib/repos'

/**
 * lib/repos: as partes puras são testadas com fs real numa pasta temporária
 * (isGitRepo/discoverRepos só usam existsSync/readdirSync — nenhum binário git
 * roda) e a lógica de caminho/auth é pura. O que spawna git (fetchRepo,
 * cloneBare, ensureFetchRefspec, denyPush, scrubPersistedToken, remoteOf)
 * fica de fora: sem seam de injeção e sem git real neste CI-safe.
 */
const tmp = mkdtempSync(join(tmpdir(), 'gitview-lib-repos-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

describe('isGitRepo', () => {
  it('aceita checkout (.git) e clone bare completo (HEAD + objects + refs)', () => {
    const checkout = join(tmp, 'checkout')
    mkdirSync(join(checkout, '.git'), { recursive: true })

    const bare = join(tmp, 'bare')
    mkdirSync(join(bare, 'objects'), { recursive: true })
    mkdirSync(join(bare, 'refs'), { recursive: true })
    writeFileSync(join(bare, 'HEAD'), 'ref: refs/heads/main\n')

    expect(isGitRepo(checkout)).toBe(true)
    expect(isGitRepo(bare)).toBe(true)
  })

  it('rejeita pasta comum e bare incompleto (só HEAD)', () => {
    const comum = join(tmp, 'comum')
    mkdirSync(comum, { recursive: true })
    const meio = join(tmp, 'bare-incompleto')
    mkdirSync(meio, { recursive: true })
    writeFileSync(join(meio, 'HEAD'), 'ref: refs/heads/main\n')

    expect(isGitRepo(comum)).toBe(false)
    expect(isGitRepo(meio)).toBe(false)
  })
})

describe('discoverRepos', () => {
  it('raiz que NÃO é repo: lista só os subrepos, ordenados por nome, ignorando não-repos e arquivos', () => {
    const root = join(tmp, 'workspace-comum')
    mkdirSync(join(root, 'alpha', '.git'), { recursive: true })
    mkdirSync(join(root, 'zeta'), { recursive: true }) // não é repo
    writeFileSync(join(root, 'soltinho.txt'), 'x') // arquivo não-diretório

    expect(discoverRepos(root)).toEqual([{ name: 'alpha', path: join(root, 'alpha') }])
  })

  it('raiz que É repo (checkout normal): entra ela mesma + os subrepos', () => {
    // NOTA: a pasta .git da raiz também passa no isGitRepo (tem HEAD/objects/
    // refs) e é listada como repo — comportamento pré-existente, declarado na
    // issue #250 como out_of_scope_findings; aqui o teste documenta o real.
    const root = join(tmp, 'workspace-repo')
    mkdirSync(join(root, '.git'), { recursive: true })
    writeFileSync(join(root, '.git', 'HEAD'), 'ref: refs/heads/main\n')
    mkdirSync(join(root, '.git', 'objects'), { recursive: true })
    mkdirSync(join(root, '.git', 'refs'), { recursive: true })
    mkdirSync(join(root, 'api', '.git'), { recursive: true })
    mkdirSync(join(root, 'web', '.git'), { recursive: true })

    const found = discoverRepos(root)
    expect(found.map(r => r.name)).toEqual(['.git', 'api', 'web', 'workspace-repo'])
    expect(found.find(r => r.name === 'workspace-repo')?.path).toBe(root)
    expect(found.find(r => r.name === 'api')?.path).toBe(join(root, 'api'))
  })
})

describe('isManagedRepo', () => {
  it('true para o próprio data/repos e qualquer filho', () => {
    expect(isManagedRepo(MANAGED_REPOS_DIR)).toBe(true)
    expect(isManagedRepo(join(MANAGED_REPOS_DIR, 'api'))).toBe(true)
    expect(isManagedRepo(join(MANAGED_REPOS_DIR, 'api', '.git'))).toBe(true)
  })

  it('false para vizinho com prefixo parecido (armadilha do startsWith sem sep) e para outros paths', () => {
    expect(isManagedRepo(`${MANAGED_REPOS_DIR}-backup`)).toBe(false)
    expect(isManagedRepo(join(tmp, 'checkout'))).toBe(false)
    expect(isManagedRepo(resolve(join(tmp, 'checkout')))).toBe(false)
  })
})

describe('resolveReposRootSafe', () => {
  it('devolve o caminho absoluto quando o reposRoot existe', () => {
    const dir = join(tmp, 'raiz-existente')
    mkdirSync(dir, { recursive: true })
    expect(resolveReposRootSafe({ reposRoot: dir })).toBe(resolve(dir))
  })
})

describe('parseGitHub', () => {
  it('extrai owner/repo de ssh e https (com/sem .git, case-insensitive no host)', () => {
    expect(parseGitHub('git@github.com:acme/api.git')).toEqual({ owner: 'acme', repo: 'api' })
    expect(parseGitHub('https://github.com/acme/api.git')).toEqual({ owner: 'acme', repo: 'api' })
    expect(parseGitHub('https://github.com/acme/api')).toEqual({ owner: 'acme', repo: 'api' })
    expect(parseGitHub('https://GitHub.com/acme/api.git')).toEqual({ owner: 'acme', repo: 'api' })
  })

  it('não-github, URL sem segunda parte e lixo devolvem null', () => {
    expect(parseGitHub('https://gitlab.com/acme/api.git')).toBeNull()
    expect(parseGitHub('https://github.com/acme')).toBeNull()
    expect(parseGitHub('não-é-url')).toBeNull()
  })
})

describe('gitAuthEnv', () => {
  it('sem token: git não-interativo com credential helper zerado', () => {
    const env = gitAuthEnv()
    expect(env.GIT_TERMINAL_PROMPT).toBe('0')
    expect(env.GCM_INTERACTIVE).toBe('never')
    expect(env.GIT_ASKPASS).toBe('echo')
    expect(env.GIT_CONFIG_KEY_0).toBe('credential.helper')
    expect(env.GIT_CONFIG_VALUE_0).toBe('')
  })

  it('com token: header basic via GIT_CONFIG_* — token fora do argv e fora do config', () => {
    const env = gitAuthEnv('segredo-fake')
    expect(env.GIT_CONFIG_KEY_0).toBe('http.https://github.com/.extraheader')
    expect(env.GIT_CONFIG_VALUE_0).toMatch(/^AUTHORIZATION: basic /)
    // o token em claro não aparece em nenhum valor do env
    expect(JSON.stringify(env)).not.toContain('segredo-fake')
  })
})

describe('mapPool', () => {
  it('processa todos os itens com concorrência limitada', async () => {
    const seen: number[] = []
    let running = 0
    let peak = 0
    await mapPool([1, 2, 3, 4, 5], 2, async (n) => {
      running++
      peak = Math.max(peak, running)
      seen.push(n)
      await new Promise(r => setTimeout(r, 1))
      running--
    })
    expect([...seen].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5])
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('lista vazia e limit maior que a lista não quebram', async () => {
    const seen: number[] = []
    await mapPool([], 3, async (n) => {
      seen.push(n)
    })
    await mapPool([7], 10, async (n) => {
      seen.push(n)
    })
    expect(seen).toEqual([7])
  })
})
