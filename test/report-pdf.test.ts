import type { MeasureFn, PdfSpan } from '../src/report-pdf'
import { Buffer } from 'node:buffer'
import { describe, expect, it } from 'vitest'
import {
  A4_LAYOUT,
  buildReportPdf,
  layoutReport,
  parseInlineSpans,
  parseReportBlocks,
  toPdfSafe,
  wrapSpans,
} from '../src/report-pdf'
import golden from './fixtures/report-default-6009b4f.json'

/** medida fake: 1pt por char — geometria determinística nos testes de layout */
const measure: MeasureFn = text => text.length

function plain(text: string): PdfSpan[] {
  return [{ text, style: 'normal' }]
}

describe('toPdfSafe — sanitização WinAnsi', () => {
  it('mantém ASCII, acentos Latin-1 e a pontuação WinAnsi medida', () => {
    expect(toPdfSafe('áàâãéêíóôõúç ÁÇÃ')).toBe('áàâãéêíóôõúç ÁÇÃ')
    expect(toPdfSafe('— – … • · “ ” ‘ ’ € ™ † œ Š Ÿ ž')).toBe('— – … • · “ ” ‘ ’ € ™ † œ Š Ÿ ž')
  })

  it('mapeia o que tem equivalente legível', () => {
    expect(toPdfSafe('5 − 3')).toBe('5 – 3')
    expect(toPdfSafe('a\u2009b\u200Ac\u202Fd')).toBe('a b c d')
    expect(toPdfSafe('x → y ← z ↔ w')).toBe('x -> y <- z <-> w')
    expect(toPdfSafe('a ≤ b ≥ c')).toBe('a <= b >= c')
    expect(toPdfSafe('20′30″')).toBe('20\'30"')
  })

  it('descarta o que não tem glifo (emoji/CJK/fora do mapa) e vira espaço em controle', () => {
    expect(toPdfSafe('fix: deploy 🚀 novo')).toBe('fix: deploy  novo')
    expect(toPdfSafe('中文字')).toBe('')
    expect(toPdfSafe('Ж')).toBe('')
    expect(toPdfSafe('a\tb')).toBe('a b')
  })
})

describe('parseInlineSpans — dialeto congelado', () => {
  it('forte, ênfase e misturas com as fronteiras do markdown.ts', () => {
    expect(parseInlineSpans('**3 commits** (+12%)')).toEqual([
      { text: '3 commits', style: 'bold' },
      { text: ' (+12%)', style: 'normal' },
    ])
    // `_…_` casa também no fim de linha (o `\b` do dialeto vê o `_` como \w)
    expect(parseInlineSpans('dados gerados em 30/10/2026_')).toEqual([{ text: 'dados gerados em 30/10/2026_', style: 'normal' }])
    expect(parseInlineSpans('_dados gerados em 30/10/2026_')).toEqual([{ text: 'dados gerados em 30/10/2026', style: 'italic' }])
    // snake_case e repo#42_x intactos
    expect(parseInlineSpans('snake_case_id e repo#42_x')).toEqual([{ text: 'snake_case_id e repo#42_x', style: 'normal' }])
  })

  it('escapes do mdText viram literal', () => {
    expect(parseInlineSpans('\\*\\*bold\\*\\* e \\_x\\_')).toEqual([{ text: '**bold** e _x_', style: 'normal' }])
    expect(parseInlineSpans('caminho C:\\\\temp')).toEqual([{ text: 'caminho C:\\temp', style: 'normal' }])
  })

  it('reconhece a entrada do anexo como metadados + mensagem (inclusive com · na mensagem)', () => {
    const [entry, fallback] = parseReportBlocks([
      '- [abc1234](https://github.com/x/y/commit/abc) · 2026-11-09 · repo-alpha · +88/-12 · prod · fix: usa · no meio da mensagem',
      '- top repos: alpha (3), beta (2)',
    ].join('\n'))
    expect(entry.kind).toBe('commitEntry')
    if (entry.kind !== 'commitEntry')
      throw new Error(`tipo inesperado: ${entry.kind}`)
    expect(entry.hash).toEqual([{ text: 'abc1234', style: 'normal', href: 'https://github.com/x/y/commit/abc' }])
    expect(entry.meta.map(span => span.text).join('')).toBe('2026-11-09 · repo-alpha · +88/-12 · prod')
    expect(entry.message.map(span => span.text).join('')).toBe('fix: usa · no meio da mensagem')
    expect(fallback.kind).toBe('bullet')
  })

  it('link https vira span com href (label com estilo); destino inválido é texto', () => {
    expect(parseInlineSpans('[abc1234](https://github.com/x/y/commit/abc) · dia')).toEqual([
      { text: 'abc1234', style: 'normal', href: 'https://github.com/x/y/commit/abc' },
      { text: ' · dia', style: 'normal' },
    ])
    expect(parseInlineSpans('**[abc](https://ex.com/a)**')).toEqual([
      { text: 'abc', style: 'bold', href: 'https://ex.com/a' },
    ])
    expect(parseInlineSpans('[x](http://inseguro.com)')).toEqual([{ text: '[x](http://inseguro.com)', style: 'normal' }])
    expect(parseInlineSpans('[x](javascript:alert(1))')).toEqual([{ text: '[x](javascript:alert(1))', style: 'normal' }])
  })
})

describe('parseReportBlocks', () => {
  it('classifica heading/bullet/parágrafo como o renderMarkdown', () => {
    const md = [
      '# Título',
      '',
      'linha de ata',
      '## Seção',
      '### Dev',
      '- bullet um',
      '- **subtotal** outro',
    ].join('\n')
    const blocks = parseReportBlocks(md)
    expect(blocks.map(b => b.kind)).toEqual(['heading', 'paragraph', 'heading', 'heading', 'bullet', 'bullet'])
    expect(blocks.map(b => (b.kind === 'heading' ? b.level : null))).toEqual([1, null, 2, 3, null, null])
  })
})

describe('wrapSpans', () => {
  it('quebra por palavra respeitando a largura máxima', () => {
    const lines = wrapSpans(plain('the quick brown fox jumps over the lazy dog'), 12, measure)
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) {
      const width = line.reduce((w, s) => w + s.text.length, 0)
      expect(width).toBeLessThanOrEqual(12)
    }
    const words = lines.map(line => line.map(s => s.text).join('')).join(' ')
    expect(words).toBe('the quick brown fox jumps over the lazy dog')
  })

  it('preserva espaços duplos internos e funde partes do mesmo estilo', () => {
    const lines = wrapSpans(plain('a  b'), 100, measure)
    // os espaços entram como span próprio e fundem com a palavra seguinte
    expect(lines).toEqual([[{ text: 'a', style: 'normal' }, { text: '  b', style: 'normal' }]])
    const mixed = wrapSpans([
      { text: 'ab', style: 'bold' },
      { text: 'cd', style: 'normal' },
    ], 100, measure)
    // 'abcd' é UMA palavra com estilo misto — não se quebra no meio
    expect(mixed).toHaveLength(1)
    expect(mixed[0]).toEqual([
      { text: 'ab', style: 'bold' },
      { text: 'cd', style: 'normal' },
    ])
  })

  it('não deixa palavra curta órfã no fim da linha', () => {
    // "aaa bbb c | dd" seria o greedy clássico; o "c" desce com o "dd"
    const lines = wrapSpans(plain('aaa bbb c dd'), 9, measure)
    expect(lines.map(line => line.map(span => span.text).join(''))).toEqual(['aaa bbb', 'c dd'])
  })
})

describe('layoutReport — paginação', () => {
  const headingSizes = [15, 12.5, 10.5]

  function flatRuns(pages: ReturnType<typeof layoutReport>) {
    return pages.flatMap(p => p.runs)
  }

  it('mantém todos os runs dentro das margens', () => {
    const blocks = parseReportBlocks(golden.markdown)
    const pages = layoutReport(blocks, measure)
    for (const run of flatRuns(pages)) {
      expect(run.x).toBeGreaterThanOrEqual(A4_LAYOUT.marginX - 0.01)
      expect(run.x + run.text.length).toBeLessThanOrEqual(A4_LAYOUT.pageWidth - A4_LAYOUT.marginX + 0.01)
      expect(run.y).toBeLessThanOrEqual(A4_LAYOUT.pageHeight - A4_LAYOUT.marginBottom + 0.01)
      expect(run.y).toBeGreaterThanOrEqual(A4_LAYOUT.marginTop)
    }
  })

  it('conteúdo grande pagina e título nunca fica órfão no fim da página', () => {
    const parts: string[] = ['# Relatório grande', 'parágrafo de abertura']
    for (let i = 0; i < 40; i++)
      parts.push(`## Seção ${i}`, `x${' '.repeat(0)}`.padEnd(500, 'y'))
    const pages = layoutReport(parseReportBlocks(parts.join('\n')), measure)
    expect(pages.length).toBeGreaterThan(2)
    for (const page of pages) {
      const last = page.runs.reduce((a, b) => (b.y > a.y ? b : a))
      expect(headingSizes).not.toContain(last.size)
    }
  })

  it('emite a régua do título e das seções', () => {
    const pages = layoutReport(parseReportBlocks('# T\n\n## S\n\n- b'), measure)
    const tones = pages.flatMap(p => p.rules.map(r => r.tone))
    expect(tones).toContain('ruleStrong')
    expect(tones).toContain('rule')
  })

  it('compõe a entrada do anexo em duas linhas: metadado discreto + mensagem', () => {
    const blocks = parseReportBlocks('- [abc1234](https://x.com/a) · 2026-11-09 · repo-a · +88/-12 · prod · fix: mensagem da entrada')
    const runs = layoutReport(blocks, measure)[0].runs.filter(run => run.text !== '\u2022')
    const metaRuns = runs.filter(run => run.size === 9)
    const messageRuns = runs.filter(run => run.size === 10)
    expect(metaRuns.map(run => run.text).join('')).toBe('abc1234 · 2026-11-09 · repo-a · +88/-12 · prod')
    expect(messageRuns.map(run => run.text).join('')).toBe('fix: mensagem da entrada')
    expect(metaRuns.every(run => run.tone === 'muted' || run.tone === 'link')).toBe(true)
    // metadado acima da mensagem
    expect(metaRuns[0].y).toBeLessThan(messageRuns[0].y)
  })

  it('metadado em ênfase e abertura ganham corpo próprios', () => {
    const blocks = parseReportBlocks('# T\n\n_dados gerados em 01/01/2026_\n\nabertura da ata\n\ncorpo comum')
    const runs = layoutReport(blocks, measure)[0].runs
    const meta = runs.find(run => run.text.includes('dados'))
    expect(meta?.tone).toBe('muted')
    expect(meta?.size).toBe(9.5)
    const lead = runs.find(run => run.text.includes('abertura'))
    expect(lead?.size).toBe(11)
    const body = runs.find(run => run.text.includes('corpo'))
    expect(body?.size).toBe(10)
  })
})

describe('buildReportPdf — render real (jsPDF)', () => {
  it('gera PDF válido do golden do motor com rodapé e sem degradação UCS-2', async () => {
    const { data, pages } = await buildReportPdf(golden.markdown, { title: golden.title })
    expect(pages).toBeGreaterThanOrEqual(1)
    expect(Buffer.from(data.slice(0, 5)).toString('latin1')).toBe('%PDF-')
    const raw = Buffer.from(data).toString('latin1')
    expect(raw).toContain('/Producer (jsPDF')
    expect(raw).toContain('/Encoding /WinAnsiEncoding')
  })

  it('texto fora do WinAnsi não contamina a linha (sem NUL = sem UCS-2)', async () => {
    const md = '# T\n\nfix: deploy 🚀 — menos 5 − 3 e 中文'
    const { data } = await buildReportPdf(md, { title: 't' })
    // streams comprimidos: varre só os descomprimidos (os operadores vivem lá)
    const { inflateSync } = await import('node:zlib')
    const raw = Buffer.from(data).toString('latin1')
    let decoded = ''
    for (const m of raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)) {
      try {
        decoded += inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')
      }
      catch {}
    }
    expect(decoded).toContain('Tj')
    // o '−' U+2212 vira travessão — byte WinAnsi 0x96 na cadeia do Tj
    expect(decoded).toContain('\u0096')
    // degradação UCS-2 = par 00 XX por char; NUL na cadeia denuncia
    for (const m of decoded.matchAll(/\(((?:[^()\\]|\\.)*)\)\s*Tj/g))
      expect(m[1]).not.toContain('\u0000')
  })

  it('links viram anotações de URI clicáveis', async () => {
    const md = '# T\n\n- [abc1234](https://github.com/x/y/commit/abc) · 2026-11-02 · repo'
    const { data } = await buildReportPdf(md, { title: 't' })
    const raw = Buffer.from(data).toString('latin1')
    expect(raw).toContain('/URI')
    expect(raw).toContain('https://github.com/x/y/commit/abc')
  })

  it('anexo gigante pagina (o PDF acompanha o conteúdo, não a impressão)', async () => {
    const lines = ['# T', '## Anexo - commits por dev', '### dev']
    for (let i = 0; i < 600; i++)
      lines.push(`- ${i.toString(16).padStart(7, '0')} · 2026-11-02 · repo-${i % 7} · +${i}/-${i} · prod · mensagem de commit ${i} com texto suficiente para quebrar linha`)
    const { data, pages } = await buildReportPdf(lines.join('\n'), { title: 'relatório com anexo grande' })
    expect(pages).toBeGreaterThan(3)
    expect(data.byteLength).toBeGreaterThan(10_000)
  })
})
