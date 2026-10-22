import { afterEach, describe, expect, it, vi } from 'vitest'
import { rangeLabel } from '../src/filters'
import { fmtDate, setFormatLocale } from '../src/format'
import { applyLocale, matchLocale, pickLocale, setupI18n } from '../src/i18n'
import enUS from '../src/locales/en-US'
import esES from '../src/locales/es-ES'
import ptBR from '../src/locales/pt-BR'

/**
 * Issue #252 — motor i18n: resolução de locale (localStorage → navigator →
 * pt-BR), paridade de chaves entre catálogos, pt-BR byte-idêntico à copy que
 * substituiu e fallback silencioso quando o chunk lazy falha.
 */

describe('matchLocale', () => {
  it('normaliza o case BCP-47', () => {
    expect(matchLocale('pt-br')).toBe('pt-BR')
    expect(matchLocale('EN-us')).toBe('en-US')
    expect(matchLocale('es-es')).toBe('es-ES')
  })

  it('cai no prefixo quando não há match exato', () => {
    expect(matchLocale('pt')).toBe('pt-BR')
    expect(matchLocale('en-GB')).toBe('en-US')
    expect(matchLocale('es-MX')).toBe('es-ES')
  })

  it('rejeita o que não é suportado', () => {
    expect(matchLocale('fr')).toBeNull()
    expect(matchLocale('de-DE')).toBeNull()
    expect(matchLocale('')).toBeNull()
  })
})

describe('pickLocale', () => {
  it('localStorage salvo tem prioridade sobre o navegador', () => {
    expect(pickLocale('es-ES', ['en-US', 'pt-BR'])).toBe('es-ES')
  })

  it('ignora valor salvo inválido e segue pro navegador', () => {
    expect(pickLocale('klingon', ['en-GB'])).toBe('en-US')
  })

  it('percorre navigator.languages em ordem', () => {
    expect(pickLocale(null, ['fr', 'es-MX', 'en'])).toBe('es-ES')
    expect(pickLocale(null, ['fr', 'de'])).toBe('pt-BR')
  })

  it('default pt-BR sem nenhuma pista', () => {
    expect(pickLocale(null, [])).toBe('pt-BR')
  })
})

// paridade de chaves entre os catálogos (chaves FLAT com prefixo — o
// resolver default do vue-i18n v11 não expande dot-path)
describe('catálogos', () => {
  it('en-US e es-ES cobrem exatamente as chaves do pt-BR', () => {
    const base = Object.keys(ptBR).sort()
    expect(Object.keys(enUS).sort()).toEqual(base)
    expect(Object.keys(esES).sort()).toEqual(base)
  })

  // byte-paridade: os valores pt-BR são a copy original extraída sem reescrita
  it('pt-BR byte-idêntico à copy original do shell', () => {
    expect(ptBR).toEqual({
      'app.loading': 'carregando…',
      'app.notFound.back': 'voltar ao início',
      'app.notFound.description': 'Esse caminho não existe no gitview.',
      'app.notFound.title': 'Página não encontrada',
      'filters.period': 'Período',
      'filters.scopes.title': 'Escopo',
      'filters.scopes.help': 'produção = commits alcançáveis da ref de produção · em progresso = branches de integração/feature. Squash/cherry-pick pode contar o mesmo trabalho duas vezes (hash novo em produção + hash original em progresso). Linhas +/− e commits seguem o recorte; streaks, PRs, releases e inatividade não têm o eixo e ficam integrais.',
      'filters.scope.all': 'Todos',
      'filters.scope.prod': 'Produção',
      'filters.scope.progress': 'Em progresso',
      'filters.chip.all': 'Tudo',
      'filters.chip.1m': '1M',
      'filters.chip.3m': '3M',
      'filters.chip.6m': '6M',
      'filters.chip.12m': '12M',
      'filters.chip.24m': '24M',
      'filters.custom': 'Personalizado',
      'filters.from': 'de',
      'filters.to': 'até',
      'filters.bots': 'incluir bots',
      'filters.times': 'Times',
      'filters.repos': 'Repos',
      'filters.devs': 'Devs',
      'filters.selectAll': 'selecionar todos',
      'filters.invert': 'inverter seleção',
      'filters.clear': 'limpar',
      'filters.clearFilters': 'limpar filtros',
      'filters.aria.selectAll': 'selecionar todos os {target}',
      'filters.aria.invert': 'inverter seleção de {target}',
      'filters.aria.clear': 'limpar seleção de {target}',
      'filters.range.all': 'histórico completo',
      'filters.range.lastMonth': 'último mês',
      'filters.range.lastN': 'últimos {n} meses',
      'filters.range.customStart': 'início',
      'filters.range.customEnd': 'hoje',
      'nav.aria.sections': 'seções',
      'nav.aria.home': 'gitview — início',
      'nav.aria.section': 'navegação da seção',
      'nav.aria.hidePanel': 'ocultar painel',
      'nav.aria.showPanel': 'mostrar painel',
      'nav.aria.tabs': 'abas do dashboard',
      'nav.page.settings': 'Configurações',
      'nav.sections.dashboards': 'Dashboards',
      'nav.sections.teams': 'Times',
      'nav.sections.prs': 'PRs',
      'nav.sections.branches': 'Branches',
      'nav.sections.repos': 'Repos',
      'nav.sections.reports': 'Relatórios',
      'nav.sections.settings': 'Config',
      'nav.subs.dashboards.overview': 'Visão geral',
      'nav.subs.dashboards.devs': 'Devs',
      'nav.subs.dashboards.health': 'Saúde',
      'nav.subs.teams.teams': 'Times',
      'nav.subs.teams.devs': 'Devs',
      'nav.subs.teams.unmapped': 'Sem mapeamento',
      'nav.subs.prs.open': 'Abertos',
      'nav.subs.prs.cycleTime': 'Cycle time',
      'nav.subs.prs.reviews': 'Reviews',
      'nav.subs.branches.landed': 'Pousadas',
      'nav.subs.branches.abandoned': 'Abandonadas',
      'nav.subs.branches.developProduction': 'develop × produção',
      'nav.subs.branches.table': 'Tabela',
      'nav.subs.repos.all': 'Todos os repositórios',
      'nav.subs.repos.table': 'Tabela',
      'nav.subs.repos.lines': 'Linhas +/−',
      'nav.subs.repos.distribution': 'Distribuição',
      'nav.subs.repos.perMonth': 'Por mês',
      'nav.subs.repos.commitTypes': 'Tipos de commit',
      'nav.subs.repos.releases': 'Releases',
      'nav.subs.repos.graph': 'Grafo',
      'nav.subs.reports.subject': 'Assunto e período',
      'nav.subs.reports.report': 'Relatório',
      'nav.subs.settings.general': 'Geral',
      'nav.subs.settings.repos': 'Repositórios',
      'nav.subs.settings.account': 'Conta GitHub',
      'navbar.generatedAt': 'dados gerados em {date}',
      'navbar.ageNow': 'agora mesmo',
      'navbar.ageHours': 'há {n}h',
      'navbar.ageDays': 'há {n}d',
      'navbar.refresh': 'atualizar dados',
      'navbar.refreshTooltip': 'atualizar dados (git + GitHub)',
      'navbar.collectError': 'erro na coleta',
      'navbar.collecting': 'coletando {step}…',
      'navbar.collectDone': 'dados atualizados',
      'navbar.collectFull': 'coleta completa (--full)',
    })
  })
})

describe('setupI18n', () => {
  // data fixa: o formato do format.ts é a prova da fiação bootstrap→setFormatLocale
  const FIXED = new Date('2026-03-09T12:00:00')

  afterEach(() => {
    // o locale do format.ts é estado de módulo — devolve o default pros demais testes
    setFormatLocale('pt-BR')
    vi.unstubAllGlobals()
  })

  it('falha no chunk lazy cai no pt-BR com warn (sem derrubar) e aplica o formato do default', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setFormatLocale('en-US')
    // loader injetado que rejeita = probe da falha de import() do chunk
    const i18n = await setupI18n('en-US', { 'en-US': () => Promise.reject(new Error('chunk boom')) })
    expect(i18n.global.locale.value).toBe('pt-BR')
    expect(warn).toHaveBeenCalledOnce()
    expect(Object.keys(i18n.global.messages.value)).toEqual(['pt-BR'])
    // o locale efetivo do catch vira o formato — não sobra o en-US setado acima
    expect(fmtDate(FIXED)).toBe(fmtDate(FIXED, 'pt-BR'))
    warn.mockRestore()
  })

  it('setupI18n em en-US troca o formato do format.ts', async () => {
    const pt = fmtDate(FIXED)
    expect(pt).toBe(fmtDate(FIXED, 'pt-BR'))
    const i18n = await setupI18n('en-US')
    expect(i18n.global.locale.value).toBe('en-US')
    expect(fmtDate(FIXED)).toBe(fmtDate(FIXED, 'en-US'))
    expect(fmtDate(FIXED)).not.toBe(pt)
  })

  it('applyLocale troca o locale, persiste gitview:lang e o formato acompanha', async () => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      getItem: (k: string) => store[k] ?? null,
    })
    // o carregamento do chunk é do chamador: aqui as duas mensagens entram juntas
    const i18n = await setupI18n('en-US')
    applyLocale(i18n, 'pt-BR')
    expect(i18n.global.locale.value).toBe('pt-BR')
    expect(store['gitview:lang']).toBe('pt-BR')
    expect(fmtDate(FIXED)).toBe(fmtDate(FIXED, 'pt-BR'))
  })

  it('applyLocale não explode com o storage bloqueado', async () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    const i18n = await setupI18n('pt-BR')
    expect(() => applyLocale(i18n, 'en-US')).not.toThrow()
    expect(i18n.global.locale.value).toBe('en-US')
  })

  it('rangeLabel re-avalia quando o locale troca', async () => {
    // o carregamento do chunk é do chamador: as duas mensagens entram no setup
    const i18n = await setupI18n('en-US')
    applyLocale(i18n, 'pt-BR')
    // rangeMonths default = 12 → o rótulo cobre também a interpolação {n}
    expect(rangeLabel.value).toBe('últimos 12 meses')
    applyLocale(i18n, 'en-US')
    expect(rangeLabel.value).toBe('last 12 months')
  })
})
