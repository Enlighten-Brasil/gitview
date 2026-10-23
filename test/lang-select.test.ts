import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { switchLang } from '../src/composables/useLangSelect'
import { fmtDate, setFormatLocale } from '../src/format'
import { getComposer, setupI18n } from '../src/i18n'

/**
 * Issue #264 — lógica do seletor de idioma: a troca carrega o chunk lazy ANTES
 * de chamar applyLocale (mensagens prontas = UI traduzida sem cair no fallback
 * pt-BR), persiste 'gitview:lang', acompanha o format.ts e é no-op quando o
 * locale pedido já é o ativo. A detecção de 1º acesso (detectLocale) segue
 * coberta em test/i18n.test.ts.
 */
describe('switchLang', () => {
  // data fixa: o formato do format.ts prova a fiação applyLocale→setFormatLocale
  const FIXED = new Date('2026-03-09T12:00:00')
  let store: Record<string, string>

  beforeEach(() => {
    store = {}
    vi.stubGlobal('localStorage', {
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      getItem: (k: string) => store[k] ?? null,
    })
  })

  afterEach(() => {
    // estado de módulo (format + composer do boot) — devolve pros demais testes
    setFormatLocale('pt-BR')
    vi.unstubAllGlobals()
  })

  it('en-US: chunk carregado antes da troca, persistência e formato acompanhando', async () => {
    await setupI18n('pt-BR')
    await switchLang('en-US')
    const { locale, t } = getComposer()
    expect(locale.value).toBe('en-US')
    expect(store['gitview:lang']).toBe('en-US')
    // valor do chunk en-US — sem mensagens o fallback pt-BR devolveria 'carregando…'
    expect(t('app.loading')).toBe('loading…')
    expect(fmtDate(FIXED)).toBe(fmtDate(FIXED, 'en-US'))
    expect(fmtDate(FIXED)).not.toBe(fmtDate(FIXED, 'pt-BR'))
  })

  it('es-ES: idem — catálogo troca junto com o locale', async () => {
    await setupI18n('pt-BR')
    await switchLang('es-ES')
    const { locale, t } = getComposer()
    expect(locale.value).toBe('es-ES')
    expect(store['gitview:lang']).toBe('es-ES')
    expect(t('app.loading')).toBe('cargando…')
    expect(fmtDate(FIXED)).toBe(fmtDate(FIXED, 'es-ES'))
  })

  it('volta pro pt-BR (eager) e persiste a escolha', async () => {
    await setupI18n('en-US')
    await switchLang('pt-BR')
    const { locale, t } = getComposer()
    expect(locale.value).toBe('pt-BR')
    expect(store['gitview:lang']).toBe('pt-BR')
    expect(t('app.loading')).toBe('carregando…')
    expect(fmtDate(FIXED)).toBe(fmtDate(FIXED, 'pt-BR'))
  })

  it('no-op no locale já ativo: não persiste de novo', async () => {
    await setupI18n('pt-BR')
    await switchLang('es-ES')
    delete store['gitview:lang']
    await switchLang('es-ES')
    expect(getComposer().locale.value).toBe('es-ES')
    // applyLocale não rodou de novo (ele persistiria) — o guard curtocircuito
    expect(store['gitview:lang']).toBeUndefined()
  })
})
