import type { BranchesData, BranchRow, GitHubData, PullRequest, Stats, TeamData } from '../src/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { abandonadas, BRANCH_STALE_DAYS, branches, branchesAge, branchGithubUrl, branchRows, hasOpenPr, integrationSkew, isSquashPousada, linkedPr, pousadas, prLinkCoverage } from '../src/branches'
import { filters, stats } from '../src/data'
import { github } from '../src/github'
import { setupI18n } from '../src/i18n'
import { team } from '../src/team'

/**
 * Issue #249 — predicados de branches: join branch↔PR (aberto > mergeado),
 * status derivados (viva-sem-PR / pousada-via-squash / abandonada) e os cards.
 * Idade medida a partir de `Date.now()` relativo (fixture dinâmica); nomes
 * genéricos (check:scrub).
 */
const DAY = 86_400_000
const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString()

function BRANCH(over: Partial<BranchRow>): BranchRow {
  return {
    name: 'feature-a',
    tip: 'aaa1111aaaaaaa',
    lastActivity: isoDaysAgo(1),
    aheadProd: 0,
    behindProd: 0,
    aheadInt: null,
    behindInt: null,
    authorsAhead: [],
    additions: 0,
    deletions: 0,
    status: 'feature',
    ...over,
  }
}

const BRANCHES: BranchesData = {
  generatedAt: new Date(Date.now() - 25 * 3_600_000).toISOString(),
  repos: [
    {
      repo: 'demo-api',
      productionRef: 'main',
      integrationRefs: ['develop'],
      branches: [
        BRANCH({ name: 'feature-live', tip: 'aaaaaaa1111111', lastActivity: isoDaysAgo(40), aheadProd: 3, aheadInt: 1, authorsAhead: ['ana@sample.test', 'ghost@sample.test'] }),
        BRANCH({ name: 'feature-squash', tip: 'bbbbbbb2222222', lastActivity: isoDaysAgo(10), aheadProd: 2 }),
        BRANCH({ name: 'feature-squash-old', tip: 'ffffff777777777', lastActivity: isoDaysAgo(45), aheadProd: 4 }),
        BRANCH({ name: 'feature-merged-later', tip: 'ccccccc3333333', lastActivity: isoDaysAgo(5), aheadProd: 2 }),
        BRANCH({ name: 'feature-reused', tip: 'ddddddd4444444', lastActivity: isoDaysAgo(1), aheadProd: 1 }),
        BRANCH({ name: 'feature-open', tip: 'eeeeeee5555555', lastActivity: isoDaysAgo(2), aheadProd: 5 }),
        BRANCH({ name: 'bot-fix', status: 'bot', aheadProd: 1 }),
        BRANCH({ name: 'main', status: 'production', tip: '999999900000000', lastActivity: isoDaysAgo(40) }),
        BRANCH({ name: 'develop', tip: '888888811112222', lastActivity: isoDaysAgo(2), aheadProd: 5, behindProd: 2, aheadInt: 0, behindInt: 0 }),
      ],
    },
    {
      repo: 'demo-web',
      productionRef: 'main',
      integrationRefs: ['develop'],
      branches: [
        BRANCH({ name: 'develop', tip: '777777733334444', lastActivity: isoDaysAgo(3), aheadProd: 7, behindProd: 0 }),
        BRANCH({ name: 'old-pousada', status: 'pousada', tip: '666666655556666', lastActivity: isoDaysAgo(6), aheadProd: 0 }),
      ],
    },
  ],
}

function PR(over: Partial<PullRequest> & { number: number }): PullRequest {
  return {
    repo: 'demo-api',
    title: 't',
    url: 'u',
    state: 'OPEN',
    draft: false,
    author: 'ana-login',
    createdAt: isoDaysAgo(20),
    mergedAt: null,
    additions: 1,
    deletions: 1,
    changedFiles: 1,
    reviews: [],
    ...over,
  }
}

const PRS: PullRequest[] = [
  // dois PRs abertos na mesma branch: o mais recente vence
  PR({ number: 11, headRef: 'feature-open', createdAt: isoDaysAgo(30) }),
  PR({ number: 12, headRef: 'feature-open', createdAt: isoDaysAgo(10) }),
  // squash: oid do head == tip da branch
  PR({ number: 20, state: 'MERGED', headRef: 'feature-squash', headRefOid: 'bbbbbbb2222222', mergedAt: isoDaysAgo(9) }),
  PR({ number: 21, state: 'MERGED', headRef: 'feature-squash-old', headRefOid: 'FFFFFF777777777', mergedAt: isoDaysAgo(44) }),
  // merge posterior à última atividade (oid diferente) também conta como liberado
  PR({ number: 22, state: 'MERGED', headRef: 'feature-merged-later', headRefOid: 'ffffffff8888888', mergedAt: isoDaysAgo(2) }),
  // branch reutilizada depois do merge: merge ANTES da última atividade e oid diferente → não é pousada
  PR({ number: 23, state: 'MERGED', headRef: 'feature-reused', headRefOid: '9999999abababab', mergedAt: isoDaysAgo(10) }),
  // mesmo headRef em outro repo: o índice é repo+headRef
  PR({ number: 30, repo: 'demo-web', state: 'MERGED', headRef: 'feature-open', headRefOid: 'eeeeeee5555555', mergedAt: isoDaysAgo(4) }),
  // cache antigo sem headRef: fica fora do índice (degrada p/ "sem vínculo")
  PR({ number: 40, state: 'MERGED', mergedAt: isoDaysAgo(6) }),
]

const GITHUB: GitHubData = { generatedAt: isoDaysAgo(0), users: {}, prs: PRS }

const TEAM: TeamData = {
  generatedAt: isoDaysAgo(0),
  devs: [{ name: 'Ana', title: null, description: null, emails: ['ana@sample.test'], githubLogins: [], teams: [], bot: false }],
  teams: [],
  candidates: [],
}

const STATS: Stats = {
  generatedAt: isoDaysAgo(0),
  repos: ['demo-api', 'demo-web'],
  repoUrls: { 'demo-api': 'https://git.example/demo' },
  authors: [{ name: 'Ana', emails: [], bot: false }],
  totals: { commits: 1, prodCommits: 1, progressCommits: 0, additions: 1, deletions: 1, activeDays: 1, repos: 2, authors: 1 },
  perRepo: [],
  perAuthor: [],
  weekly: [],
  monthly: [],
  heatmap: [],
}

beforeEach(() => {
  Object.assign(filters, {
    repos: [],
    authors: [],
    rangeMonths: 12,
    dateFrom: null,
    dateTo: null,
    showBots: false,
    workScope: 'all',
  })
  branches.value = BRANCHES
  github.value = GITHUB
  team.value = TEAM
  stats.value = STATS
})

describe('linkedPr / hasOpenPr (join repo+headRef)', () => {
  it('precedência do PR aberto mais recente; senão o mergeado mais recente', () => {
    expect(linkedPr('demo-api', 'feature-open')?.number).toBe(12)
    expect(hasOpenPr('demo-api', 'feature-open')).toBe(true)
    expect(linkedPr('demo-api', 'feature-reused')?.number).toBe(23)
    expect(linkedPr('demo-web', 'feature-open')?.number).toBe(30)
    expect(linkedPr('demo-api', 'feature-live')).toBeNull()
    expect(hasOpenPr('demo-api', 'feature-live')).toBe(false)
    expect(linkedPr('demo-api', 'feature-open-outra')).toBeNull()
  })
})

describe('isSquashPousada', () => {
  it('exige trabalho à frente e vínculo: oid (prefixo ≥7, case-insensitive) ou merge posterior', () => {
    const row = (over: Partial<BranchRow>) => BRANCHES.repos[0]!.branches.find(b => b.name === over.name)!
    expect(isSquashPousada('demo-api', row({ name: 'feature-squash' }))).toBe(true) // oid igual
    expect(isSquashPousada('demo-api', row({ name: 'feature-squash-old' }))).toBe(true) // oid c/ caixa diferente
    expect(isSquashPousada('demo-api', row({ name: 'feature-merged-later' }))).toBe(true) // merge pós-atividade
    expect(isSquashPousada('demo-api', row({ name: 'feature-reused' }))).toBe(false) // reutilizada: merge velho + oid novo
    expect(isSquashPousada('demo-api', BRANCH({ name: 'feature-squash', aheadProd: 0 }))).toBe(false) // sem trabalho à frente
    // prefixo de oid com < 7 hex não casa — e o merge anterior à atividade não salva
    expect(isSquashPousada('demo-api', BRANCH({ name: 'feature-squash', tip: 'abc', aheadProd: 2, lastActivity: isoDaysAgo(1) }))).toBe(false)
  })
})

describe('branchRows — derivados', () => {
  it('viva-sem-PR / abandonada / squashPousada com as regras #235 e o join desligado sem github.json', () => {
    const byName = new Map(branchRows.value.map(r => [r.name, r]))

    expect(byName.get('feature-live')).toMatchObject({ vivaSemPr: true, abandonada: true, squashPousada: false, ageDays: 40 })
    expect(byName.get('feature-reused')).toMatchObject({ vivaSemPr: true, abandonada: false }) // recente demais p/ abandonada
    expect(byName.get('feature-open')).toMatchObject({ vivaSemPr: false, pr: expect.objectContaining({ number: 12 }) })
    expect(byName.get('feature-squash')).toMatchObject({ vivaSemPr: false, squashPousada: true, abandonada: false })
    expect(byName.get('main')).toMatchObject({ vivaSemPr: false, abandonada: false })
    expect(byName.get('feature-live')!.authorNames).toEqual(['Ana', 'ghost@sample.test'])
    expect(byName.get('feature-live')!.authorNamesTop).toEqual(['Ana', 'ghost@sample.test'])
    expect(byName.get('feature-live')!.githubUrl).toBe('https://git.example/demo/tree/feature-live')
    expect(byName.get('old-pousada')!.githubUrl).toBeNull() // demo-web sem repoUrls
    expect(byName.get('old-pousada')!.pr).toBeNull() // sem PR vinculado ≠ "sem PR"

    github.value = null // sem github.json: derivados desligados, coluna de PR "sem vínculo"
    const semJoin = branchRows.value.find(r => r.name === 'feature-live')!
    expect(semJoin.vivaSemPr).toBe(false)
    expect(semJoin.squashPousada).toBe(false)
    expect(semJoin.pr).toBeNull()
  })

  it('bots seguem o switch da sidebar; filtro de devs casa os nomes resolvidos', () => {
    expect(branchRows.value.some(r => r.name === 'bot-fix')).toBe(false)
    filters.showBots = true
    expect(branchRows.value.some(r => r.name === 'bot-fix')).toBe(true)
    filters.showBots = false

    filters.authors = ['Ana']
    expect(branchRows.value.map(r => r.name)).toEqual(['feature-live']) // e-mail resolvido via team.json
    filters.authors = ['ghost@sample.test'] // e-mail desconhecido mantém o cru e casa direto
    expect(branchRows.value.map(r => r.name)).toEqual(['feature-live'])
  })

  it('semântica de período não se aplica — inventário é "agora"', () => {
    filters.dateFrom = '2026-01-01'
    filters.dateTo = '2026-01-31'
    expect(branchRows.value.length).toBeGreaterThan(5)
  })
})

describe('cards e apoios', () => {
  it('pousadas (status do coletor ou squash velho) e abandonadas são disjuntos', () => {
    expect(pousadas.value.map(r => r.name)).toEqual(['feature-squash-old', 'old-pousada'])
    expect(abandonadas.value.map(r => r.name)).toEqual(['feature-live'])
    expect(pousadas.value.some(r => r.name === 'feature-live')).toBe(false)
  })

  it('prLinkCoverage mede o cache antigo; null sem prs', () => {
    expect(prLinkCoverage.value).toEqual({ withHead: 7, total: 8, pct: 88 })
    github.value = null
    expect(prLinkCoverage.value).toBeNull()
    github.value = { ...GITHUB, prs: [] }
    expect(prLinkCoverage.value).toBeNull()
  })

  it('branchGithubUrl usa repoUrls do stats', () => {
    expect(branchGithubUrl('demo-api', 'main')).toBe('https://git.example/demo/tree/main')
    expect(branchGithubUrl('demo-web', 'main')).toBeNull()
  })

  it('integrationSkew: só a 1ª ref de integração desviada, ordenada por ahead', () => {
    expect(integrationSkew.value.map(s => [s.repo, s.ahead, s.behind, s.stale])).toEqual([
      ['demo-web', 7, 0, false],
      ['demo-api', 5, 2, false],
    ])
    filters.repos = ['demo-api']
    expect(integrationSkew.value.map(s => s.repo)).toEqual(['demo-api'])
  })

  it('branchesAge: frescor da coleta ("agora mesmo" / "há Nd", stale ≥ 24h)', async () => {
    // o label sai do catálogo (navbar.age* pelo composer global) — bootstrap antes de ler
    await setupI18n('pt-BR')
    expect(branchesAge.value).toEqual({ label: 'há 1d', stale: true, generatedAt: BRANCHES.generatedAt })
    branches.value = { ...BRANCHES, generatedAt: new Date().toISOString() }
    expect(branchesAge.value).toMatchObject({ label: 'agora mesmo', stale: false })
    branches.value = null
    expect(branchesAge.value).toBeNull()
  })

  it('constante BRANCH_STALE_DAYS espelha o default do coletor', () => {
    expect(BRANCH_STALE_DAYS).toBe(30)
  })
})
