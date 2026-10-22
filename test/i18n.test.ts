import { describe, expect, it, vi } from 'vitest'
import { matchLocale, pickLocale, setupI18n } from '../src/i18n'
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
      'nav.aria.sections': 'seções',
      'nav.aria.home': 'gitview — início',
      'nav.aria.section': 'navegação da seção',
      'nav.aria.hidePanel': 'ocultar painel',
      'nav.aria.showPanel': 'mostrar painel',
      'nav.aria.tabs': 'abas do dashboard',
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
  it('falha no chunk lazy cai no pt-BR com warn (sem derrubar)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    // loader injetado que rejeita = probe da falha de import() do chunk
    const i18n = await setupI18n('en-US', { 'en-US': () => Promise.reject(new Error('chunk boom')) })
    expect(i18n.global.locale.value).toBe('pt-BR')
    expect(warn).toHaveBeenCalledOnce()
    expect(Object.keys(i18n.global.messages.value)).toEqual(['pt-BR'])
    warn.mockRestore()
  })
})
