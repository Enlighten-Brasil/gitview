import type { InjectionKey } from 'vue'
import type { FilterScope } from '../src/router/meta'
import type { Stats } from '../src/types'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Issue #249 — build/sanitize/parse da URL. O módulo injeta rota/roterador
 * pela composition API (`useRoute`/`useRouter`), então o stub é o próprio
 * contexto de injeção (routerKey/routeLocationKey exportados pelo vue-router)
 * — sem vi.mock. Globals de browser (location/localStorage/history/window)
 * não existem em node e entram via stubGlobal. Cenário = boot: `vi.resetModules`
 * zera o guard `initialized` e o store para um init limpo por teste.
 */
type DataModule = typeof import('../src/data')

interface Boot {
  filters: DataModule['filters']
  stats: DataModule['stats']
  replaced: string[]
  hooks: ((to: { meta: { filters?: FilterScope } }) => void)[]
  pops: (() => void)[]
  saved: Map<string, string>
  loc: { pathname: string, search: string, hash: string }
  nextTick: () => Promise<void>
}

async function boot(opts: { search?: string, scope?: FilterScope, saved?: Record<string, string> } = {}): Promise<Boot> {
  vi.resetModules()
  const replaced: string[] = []
  const hooks: ((to: { meta: { filters?: FilterScope } }) => void)[] = []
  const pops: (() => void)[] = []
  const saved = new Map<string, string>(Object.entries(opts.saved ?? {}))
  const loc = { pathname: '/dash', search: opts.search ?? '', hash: '#top' }

  vi.stubGlobal('location', loc)
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => saved.get(k) ?? null,
    setItem: (k: string, v: string) => {
      saved.set(k, v)
    },
  })
  vi.stubGlobal('history', {
    state: { key: 'internal' },
    replaceState: (_state: unknown, _title: string, url?: string) => {
      replaced.push(String(url))
    },
  })
  vi.stubGlobal('window', {
    addEventListener: (type: string, fn: () => void) => {
      if (type === 'popstate')
        pops.push(fn)
    },
  })

  const route = { meta: { filters: opts.scope ?? 'full' } }
  const router = { afterEach: (fn: (to: { meta: { filters?: FilterScope } }) => void) => void hooks.push(fn) }

  const [{ routeLocationKey, routerKey }, { createApp, nextTick }, urlState, data] = await Promise.all([
    import('vue-router'),
    import('vue'),
    import('../src/urlState'),
    import('../src/data'),
  ])
  const app = createApp({})
  app.provide(routerKey as InjectionKey<unknown>, router)
  app.provide(routeLocationKey as InjectionKey<unknown>, route)
  app.runWithContext(() => urlState.initUrlState())

  return { filters: data.filters, stats: data.stats, replaced, hooks, pops, saved, loc, nextTick }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

const STATS = {
  generatedAt: '2026-10-15T12:00:00.000Z',
  repos: ['demo-api'],
  authors: [{ name: 'Ana', emails: [], bot: false }],
  totals: { commits: 1, prodCommits: 1, progressCommits: 0, additions: 1, deletions: 1, activeDays: 1, repos: 1, authors: 1 },
  perRepo: [],
  perAuthor: [],
  weekly: [],
  monthly: [],
  heatmap: [],
} as unknown as Stats

describe('parseUrl na inicialização (escopo full)', () => {
  it('aplica período, seleção e escopo de trabalho da query', async () => {
    const { filters } = await boot({
      search: '?range=6&from=2026-01-01&to=2026-06-30&bots=1&repos=api,web&devs=Ana,Beto&scope=prod',
    })
    expect(filters.dateFrom).toBe('2026-01-01')
    expect(filters.dateTo).toBe('2026-06-30')
    expect(filters.rangeMonths).toBe(12) // range customizado prevalece sobre o preset
    expect(filters.showBots).toBe(true)
    expect(filters.repos).toEqual(['api', 'web'])
    expect(filters.authors).toEqual(['Ana', 'Beto'])
    expect(filters.workScope).toBe('prod')
  })

  it('range inválido/ausente e data malformada caem no default', async () => {
    expect((await boot({ search: '?range=all' })).filters.rangeMonths).toBeNull()
    expect((await boot({ search: '?range=24' })).filters.rangeMonths).toBe(24)
    expect((await boot({ search: '?range=7' })).filters.rangeMonths).toBe(12) // fora de RANGES
    expect((await boot({ search: '?from=01-01-2026' })).filters.dateFrom).toBeNull() // fora de DATE_RE
    expect((await boot({ search: '?scope=banana' })).filters.workScope).toBe('all') // fora da união fechada
    expect((await boot({ search: '?scope=progress' })).filters.workScope).toBe('progress')
  })

  it('sem params de período/escopo na URL, cai no último range/scope do localStorage', async () => {
    expect((await boot({ saved: { 'gitview:range': '6', 'gitview:scope': 'prod' } })).filters)
      .toMatchObject({ rangeMonths: 6, workScope: 'prod' })
    expect((await boot({ saved: { 'gitview:range': 'all' } })).filters.rangeMonths).toBeNull()
    // salvo inválido é ignorado — não abre brecha p/ valor fora da união fechada
    expect((await boot({ saved: { 'gitview:range': '99', 'gitview:scope': 'banana' } })).filters)
      .toMatchObject({ rangeMonths: 12, workScope: 'all' })
  })
})

describe('escopo de rota (FilterScope)', () => {
  it('escopo period: só o período vale; devs/repos/bots ficam de fora', async () => {
    const { filters } = await boot({ search: '?devs=Ana&repos=api&bots=1&range=3', scope: 'period' })
    expect(filters).toMatchObject({ rangeMonths: 3, authors: [], repos: [], showBots: false })
  })

  it('escopo period-bots leva bots; escopo team leva repos e não devs', async () => {
    const bots = await boot({ search: '?bots=1&range=3', scope: 'period-bots' })
    expect(bots.filters).toMatchObject({ showBots: true, rangeMonths: 3 })

    const team = await boot({ search: '?devs=Ana&repos=api&range=3', scope: 'team' })
    expect(team.filters).toMatchObject({ repos: ['api'], authors: [], rangeMonths: 3 })
  })

  it('escopo none: urlState não atua', async () => {
    const { filters, replaced, pops } = await boot({ search: '?range=1&repos=api', scope: 'none' })
    expect(filters).toMatchObject({ rangeMonths: 12, repos: [] })
    expect(replaced).toEqual([])
    pops[0]?.()
    expect(filters.rangeMonths).toBe(12)
  })
})

describe('buildUrl (watcher de filtros)', () => {
  it('grava só o que difere do default, preserva a âncora e persiste no localStorage', async () => {
    const b = await boot()
    expect(b.replaced).toEqual([]) // nada reescrito até o 1º clique em filtro

    b.filters.rangeMonths = 6
    await b.nextTick()
    expect(b.replaced.at(-1)).toBe('/dash?range=6#top')
    expect(b.saved.get('gitview:range')).toBe('6')
    expect(b.saved.get('gitview:scope')).toBe('all')

    b.filters.rangeMonths = 12 // default → param some da URL
    await b.nextTick()
    expect(b.replaced.at(-1)).toBe('/dash#top')

    b.filters.rangeMonths = null
    await b.nextTick()
    expect(b.replaced.at(-1)).toBe('/dash?range=all#top')

    b.filters.rangeMonths = 12
    b.filters.dateFrom = '2026-01-01'
    await b.nextTick()
    expect(b.replaced.at(-1)).toBe('/dash?from=2026-01-01#top')

    b.filters.dateFrom = null
    b.filters.repos = ['api']
    b.filters.authors = ['Ana']
    b.filters.showBots = true
    b.filters.workScope = 'prod'
    await b.nextTick()
    expect(b.replaced.at(-1)).toBe('/dash?repos=api&devs=Ana&bots=1&scope=prod#top')
    expect(b.saved.get('gitview:scope')).toBe('prod')
  })

  it('escopo period omite repos/devs/bots, mas o ?scope= vale em todo escopo', async () => {
    const b = await boot({ scope: 'period' })
    b.filters.repos = ['api']
    b.filters.authors = ['Ana']
    b.filters.showBots = true
    b.filters.rangeMonths = 6
    b.filters.workScope = 'prod'
    await b.nextTick()
    expect(b.replaced.at(-1)).toBe('/dash?range=6&scope=prod#top')
  })
})

describe('sanitize (watch de stats)', () => {
  it('derruba repos/devs que não existem nos dados e preserva os que existem', async () => {
    const b = await boot()
    b.filters.repos = ['demo-api', 'ghost-repo']
    b.filters.authors = ['Ana', 'Ghost']
    b.filters.workScope = 'progress'
    b.stats.value = STATS
    await b.nextTick()
    expect(b.filters.repos).toEqual(['demo-api'])
    expect(b.filters.authors).toEqual(['Ana'])
    expect(b.filters.workScope).toBe('progress') // dados com prodCommits: escopo segue de pé
  })

  it('dados pré-#119 (sem prodCommits) forçam o escopo default all', async () => {
    const b = await boot()
    b.filters.workScope = 'progress'
    // totals sem a chave prodCommits (feature-detect com `in`, não com o valor)
    const legacyTotals = { commits: 1, progressCommits: 0, additions: 1, deletions: 1, activeDays: 1, repos: 1, authors: 1 }
    b.stats.value = { ...STATS, totals: legacyTotals } as unknown as Stats
    await b.nextTick()
    expect(b.filters.workScope).toBe('all')
  })
})

describe('popstate e navegação', () => {
  it('popstate reseta os defaults da rota e reaplica só o que a URL nova tem', async () => {
    const b = await boot({ search: '?range=all' })
    expect(b.filters.rangeMonths).toBeNull()
    b.filters.repos = ['api'] // estado do clique anterior — tem que sumir no voltar
    b.loc.search = '?range=3'
    b.pops[0]?.()
    expect(b.filters).toMatchObject({ rangeMonths: 3, repos: [], showBots: false, workScope: 'all' })
  })

  it('afterEach: navegação aplica os params sem resetar o resto e regrava a query', async () => {
    const b = await boot()
    b.loc.search = '?range=24'
    b.hooks[0]?.({ meta: { filters: 'full' } })
    expect(b.filters.rangeMonths).toBe(24)
    expect(b.replaced.at(-1)).toBe('/dash?range=24#top')

    const before = b.replaced.length
    b.hooks[0]?.({ meta: { filters: 'none' } })
    expect(b.replaced).toHaveLength(before)
  })
})
