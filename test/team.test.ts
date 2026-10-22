import { describe, expect, it } from 'vitest'
import { BOT_BRANCH_RE, BOT_LOGIN_RE, botAuthorNames, botBranchSet, botLoginSet, DEFAULT_GITHUB_BOTS, resolveAliases } from '../scripts/lib/team'

/**
 * lib/team é pura (só objetos do Config, nada de fs/git/rede) — CI-safe por
 * construção. Prioridades da issue #250: merge por nome normalizado em
 * resolveAliases e o sufixo de bot (BOT_LOGIN_RE vs BOT_BRANCH_RE).
 */
describe('resolveAliases', () => {
  it('merge e-mails e logins normalizados (lowercase) para o nome canônico', () => {
    const { emailToCanonical, loginToCanonical } = resolveAliases({
      devProfiles: {
        'Ana Silva': { emails: ['Ana.Silva@Example.com', 'ana@old.dev'], githubLogins: ['AnaSilva'] },
        'Bruno': { emails: ['bruno@example.com'], githubLogins: ['bruno', 'bruno-alt'] },
      },
    })
    expect(emailToCanonical.get('ana.silva@example.com')).toBe('Ana Silva')
    expect(emailToCanonical.get('ana@old.dev')).toBe('Ana Silva')
    expect(loginToCanonical.get('anasilva')).toBe('Ana Silva')
    expect(loginToCanonical.get('bruno-alt')).toBe('Bruno')
    expect(emailToCanonical.get('unknown@example.com')).toBeUndefined()
  })

  it('mesmo e-mail em caixas diferentes colide no nome normalizado — o último perfil vence (ordem do objeto)', () => {
    const { emailToCanonical } = resolveAliases({
      devProfiles: {
        'Dev A': { emails: ['x@y.z'] },
        'Dev B': { emails: ['X@Y.z'] },
      },
    })
    expect(emailToCanonical.get('x@y.z')).toBe('Dev B')
  })

  it('sem devProfiles devolve mapas vazios', () => {
    const { emailToCanonical, loginToCanonical } = resolveAliases({})
    expect(emailToCanonical.size).toBe(0)
    expect(loginToCanonical.size).toBe(0)
  })
})

describe('botLoginSet e o sufixo de bot (BOT_LOGIN_RE)', () => {
  it('casa sufixo \'[bot]\', sufixo \'-bot\' e prefixo \'dependabot\' — em qualquer caixa', () => {
    for (const login of ['dependabot[bot]', 'renovate-bot', 'dependabot', 'some-Bot'])
      expect(BOT_LOGIN_RE.test(login)).toBe(true)
    for (const login of ['ana.silva', 'developer', 'botanic'])
      expect(BOT_LOGIN_RE.test(login)).toBe(false)
  })

  it('o login \'renovate\' NÃO casa BOT_LOGIN_RE — por isso branches de bot têm padrão próprio', () => {
    expect(BOT_LOGIN_RE.test('renovate')).toBe(false)
  })

  it('botLoginSet soma DEFAULT_GITHUB_BOTS + githubBots, tudo lowercase', () => {
    const set = botLoginSet({ githubBots: ['MyBot', 'RENOWATE'] })
    expect(set.has('dependabot')).toBe(true)
    expect(set.has('mybot')).toBe(true)
    expect(set.has('renowate')).toBe(true)
    expect(set.size).toBe(DEFAULT_GITHUB_BOTS.length + 2)
  })
})

describe('botBranchSet e branches de bot (BOT_BRANCH_RE)', () => {
  it('casa \'dependabot/\' e \'renovate/\' no início; sufixo/substring no meio não casa', () => {
    expect(BOT_BRANCH_RE.test('dependabot/npm_and_yarn')).toBe(true)
    expect(BOT_BRANCH_RE.test('renovate/lodash-2.0.0')).toBe(true)
    expect(BOT_BRANCH_RE.test('feature/add-renovate')).toBe(false)
    expect(BOT_BRANCH_RE.test('renovate')).toBe(false)
  })

  it('botBranchSet normaliza os nomes exatos para lowercase', () => {
    const set = botBranchSet({ botBranches: ['Backport', 'hotFIX'] })
    expect(set.has('backport')).toBe(true)
    expect(set.has('hotfix')).toBe(true)
    expect(botBranchSet({}).size).toBe(0)
  })
})

describe('botAuthorNames', () => {
  it('nome terminando em [bot] (qualquer caixa) ou presente em config.bots (case-insensitive)', () => {
    const authors = [
      { name: 'dependabot[bot]' },
      { name: 'Some Bot[BOT]' },
      { name: 'Ana Silva' },
      { name: 'Renovate Bot' },
    ]
    expect(botAuthorNames({ bots: ['renovate bot'] }, authors))
      .toEqual(new Set(['dependabot[bot]', 'Some Bot[BOT]', 'Renovate Bot']))
  })
})
