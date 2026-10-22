import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { devicePoll, deviceStart, ghApi, ghApiAll, ghGraphql, GhHttpError, listOrgMembers, listOrgRepos, listOrgTeams, retryAfterFromHeaders } from '../scripts/lib/github'

/**
 * lib/github sem rede real: fetch stubado por cenário (decisão baked da issue
 * #250). Cobertura: construção de chamadas/headers, paginação, janela de retry
 * e tratamento de erro (REST, GraphQL e device flow). getToken() fica de fora:
 * lê o .env da máquina e spawna o gh CLI (estado de máquina, não CI-safe).
 */
interface RecordedCall { url: string, init?: RequestInit }

let calls: RecordedCall[] = []
let responder: (url: string, init?: RequestInit) => Response

function jsonRes(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

beforeEach(() => {
  calls = []
  responder = () => jsonRes([])
  vi.stubGlobal('fetch', (input: unknown, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    return Promise.resolve(responder(url, init))
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('ghApi', () => {
  it('monta a URL base, os headers da API e devolve o JSON', async () => {
    responder = () => jsonRes({ login: 'dev-exemplo' })
    await expect(ghApi<{ login: string }>('/user', 'tkn')).resolves.toEqual({ login: 'dev-exemplo' })
    expect(calls[0].url).toBe('https://api.github.com/user')
    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tkn')
    expect(headers.Accept).toBe('application/vnd.github+json')
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28')
    expect(headers['User-Agent']).toBe('gitview')
  })

  it('http ≠ ok lança GhHttpError com status, mensagem e janela de retry do header', async () => {
    responder = () => jsonRes({ message: 'rate limited' }, 403, { 'retry-after': '30' })
    const err = await ghApi<never>('/user', 'tkn').catch((e: GhHttpError) => e)
    expect(err).toBeInstanceOf(GhHttpError)
    expect(err.name).toBe('GhHttpError')
    expect(err.status).toBe(403)
    expect(err.retryAfterMs).toBe(30_000)
    expect(err.message).toBe('GitHub API /user: HTTP 403')
  })
})

describe('retryAfterFromHeaders', () => {
  it('retry-after (segundos) tem prioridade sobre x-ratelimit-reset e cap de 60s', () => {
    expect(retryAfterFromHeaders(new Headers({ 'retry-after': '5' }))).toBe(5000)
    expect(retryAfterFromHeaders(new Headers({ 'retry-after': '3600', 'x-ratelimit-reset': '1' }))).toBe(60_000)
  })

  it('sem retry-after usa o reset (epoch s, floor 0, cap 60s); sem nenhum ou inválido é null', () => {
    const soon = String(Math.floor(Date.now() / 1000) + 10)
    const ms = retryAfterFromHeaders(new Headers({ 'x-ratelimit-reset': soon }))
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(10_000)
    expect(retryAfterFromHeaders(new Headers({ 'x-ratelimit-reset': '1' }))).toBe(0) // epoch no passado -> 0
    expect(retryAfterFromHeaders(new Headers())).toBeNull()
    expect(retryAfterFromHeaders(new Headers({ 'retry-after': '0' }))).toBeNull()
    expect(retryAfterFromHeaders(new Headers({ 'retry-after': 'abc' }))).toBeNull()
  })
})

describe('ghApiAll', () => {
  it('pagina ?per_page=100&page=N e para quando a página vem incompleta', async () => {
    const page1 = Array.from({ length: 100 }, (_, i) => ({ n: i }))
    responder = url => jsonRes(url.includes('page=2') ? [{ n: 100 }] : page1)
    const out = await ghApiAll<{ n: number }>('/user/orgs', 'tkn')
    expect(out).toHaveLength(101)
    expect(calls.map(c => c.url)).toEqual([
      'https://api.github.com/user/orgs?per_page=100&page=1',
      'https://api.github.com/user/orgs?per_page=100&page=2',
    ])
  })

  it('usa "&" como separador quando o path já tem query', async () => {
    await ghApiAll('/x?type=all', 'tkn')
    expect(calls[0].url).toBe('https://api.github.com/x?type=all&per_page=100&page=1')
  })
})

describe('endpoints REST', () => {
  it('codifica a org na URL (membros, times, repos)', async () => {
    const last = () => calls[calls.length - 1].url
    await listOrgMembers('tkn', 'acme inc')
    expect(last()).toBe('https://api.github.com/orgs/acme%20inc/members?per_page=100&page=1')

    await listOrgTeams('tkn', 'acme inc')
    expect(last()).toBe('https://api.github.com/orgs/acme%20inc/teams?per_page=100&page=1')

    await listOrgRepos('tkn', 'acme inc')
    expect(last()).toBe('https://api.github.com/orgs/acme%20inc/repos?type=all&per_page=100&page=1')
  })

  it('listOrgTeams: falha ao buscar membros de um time vira [] naquele time (não derruba o resto)', async () => {
    responder = (url) => {
      if (url.includes('/teams?'))
        return jsonRes([{ slug: 'alpha', name: 'Alpha', description: null }, { slug: 'beta', name: 'Beta', description: null }])
      if (url.includes('/teams/alpha/members'))
        return jsonRes({ message: 'no access' }, 403)
      return jsonRes([{ login: 'dev-exemplo' }])
    }
    await expect(listOrgTeams('tkn', 'acme')).resolves.toEqual([
      { slug: 'alpha', name: 'Alpha', description: null, members: [] },
      { slug: 'beta', name: 'Beta', description: null, members: ['dev-exemplo'] },
    ])
  })
})

describe('ghGraphql', () => {
  it('post com query/variables em JSON e devolve data', async () => {
    responder = () => jsonRes({ data: { viewer: { login: 'dev-exemplo' } } })
    const query = 'query ($o: String!) { viewer { login } }'
    await expect(ghGraphql(query, { o: 'acme' }, 'tkn')).resolves.toEqual({ viewer: { login: 'dev-exemplo' } })
    expect(calls[0].init?.method).toBe('POST')
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ query, variables: { o: 'acme' } })
    const headers = calls[0].init?.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('errors[] no body vira Error "graphql: …"; HTTP ≠ ok vira GhHttpError com a mensagem do body', async () => {
    responder = () => jsonRes({ errors: [{ message: 'Bad credentials' }] })
    await expect(ghGraphql('query { viewer }', {}, 'tkn')).rejects.toThrow('graphql: Bad credentials')

    responder = () => jsonRes({ message: 'Resource not accessible' }, 401)
    const err = await ghGraphql<never>('query { viewer }', {}, 'tkn').catch((e: GhHttpError) => e)
    expect(err).toBeInstanceOf(GhHttpError)
    expect(err.message).toBe('GitHub GraphQL: HTTP 401 — Resource not accessible')
  })
})

describe('device flow', () => {
  it('deviceStart: GitHub App (Iv…) não manda scope; OAuth App manda repo read:org', async () => {
    const resposta = { device_code: 'dc', user_code: 'ABCD-EFGH', verification_uri: 'https://github.com/login/device', interval: 5 }
    responder = (_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({ client_id: 'Iv123abc' }) // sem scope
      return jsonRes(resposta)
    }
    await expect(deviceStart('Iv123abc')).resolves.toEqual({
      deviceCode: 'dc',
      userCode: 'ABCD-EFGH',
      verificationUri: 'https://github.com/login/device',
      interval: 5,
    })

    responder = (_url, init) => {
      expect(JSON.parse(String(init?.body))).toEqual({ client_id: 'Ov123abc', scope: 'repo read:org' })
      return jsonRes({ device_code: 'dc2', user_code: 'IJKL-MNOP', verification_uri: 'https://github.com/login/device' })
    }
    const out = await deviceStart('Ov123abc')
    expect(out.deviceCode).toBe('dc2')
    expect(out.interval).toBe(5) // default quando o body não manda interval
  })

  it('deviceStart sem device_code lança com error_description', async () => {
    responder = () => jsonRes({ error: 'incorrect_device_code', error_description: 'código inválido' })
    await expect(deviceStart('Ov1')).rejects.toThrow('device flow: código inválido')
  })

  it('devicePoll mapeia access_token e cada estado de erro', async () => {
    responder = () => jsonRes({ access_token: 'ghu-exemplo' })
    await expect(devicePoll('Ov1', 'dc')).resolves.toEqual({ status: 'ok', token: 'ghu-exemplo' })

    const estados: Record<string, string> = {
      authorization_pending: 'pending',
      slow_down: 'slow_down',
      access_denied: 'denied',
      expired_token: 'expired', // default: qualquer outro erro = expirado
    }
    for (const [erro, status] of Object.entries(estados)) {
      responder = () => jsonRes({ error: erro })
      await expect(devicePoll('Ov1', 'dc')).resolves.toEqual({ status })
    }

    responder = () => jsonRes({}, 500)
    await expect(devicePoll('Ov1', 'dc')).rejects.toThrow('device poll: HTTP 500')
  })
})
