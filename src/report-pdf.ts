/**
 * PDF nativo dos relatórios — exportação .pdf tipografada a partir do markdown
 * CONGELADO do motor (buildReport). O artefato .md continua byte a byte o
 * mesmo (goldens intocados); este módulo só o compõe em A4 com paginação real
 * (conteúdo grande — anexo de commits — quebra páginas, não a impressão).
 *
 * Camadas:
 * - parse: o dialeto pequeno (h1–h3, parágrafo, bullet, **forte**, _ênfase_,
 *   [label](https://…), escapes do mdText) → blocos de spans;
 * - wrap + layout: PUROS, com a medida de texto injetada (`MeasureFn`) — é a
 *   parte coberta por teste (paginação, keep-with-next de títulos, margens);
 * - render: jsPDF por import DINÂMICO (chunk só carrega quando o usuário
 *   pede o PDF), com rodapé "Página X de Y", réguas de seção e links clicáveis
 *   (as anotações de URI levam a URL https já validada pelo emissor).
 *
 * Encoding (medido no jsPDF 4.2.1): as fontes padrão saem com
 * /WinAnsiEncoding e o to8bitStream re-encoda a string INTEIRA em UCS-2 BE se
 * sobrar UM char fora do WinAnsi — a linha toda viraria glifos quebrados. Por
 * isso `toPdfSafe` normaliza o markdown ANTES de medir e desenhar: chars
 * WinAnsi (acentos, – — … • · " ") ficam como são; '−' U+2212 vira '–'
 * (medido: não mapeia) e o que não tem glifo (emoji, CJK) cai — o .md
 * exportado continua com os bytes exatos, só o PDF normaliza.
 */
import { safeHttpsHref } from './markdown'
import { reportT } from './report-i18n'

// ---------------------------------------------------------------------------
// tipos
// ---------------------------------------------------------------------------
export type PdfStyle = 'normal' | 'bold' | 'italic' | 'bolditalic'

export interface PdfSpan {
  text: string
  style: PdfStyle
  /** URL https validada — ausente = texto comum */
  href?: string
  /** sobrescrita de composição usada pelo layout (linha de metadado, anexo) */
  tone?: PdfTone
  /** sobrescrita de corpo em pt (linha de metadado menor que a mensagem) */
  size?: number
}

export type PdfBlock
  = | { kind: 'heading', level: 1 | 2 | 3, spans: PdfSpan[] }
    | { kind: 'paragraph', spans: PdfSpan[] }
    | { kind: 'bullet', spans: PdfSpan[] }
    /** entrada do anexo: metadados (hash · dia · repo · diff · escopo) + mensagem */
    | { kind: 'commitEntry', hash: PdfSpan[], meta: PdfSpan[], message: PdfSpan[] }

/** medida de texto em pt para o estilo dado (injetada: jsPDF no render, fake no teste) */
export interface MeasureFn {
  (text: string, style: PdfStyle): number
}

export type PdfTone = 'ink' | 'muted' | 'link' | 'rule' | 'ruleStrong'

export interface PdfRun {
  text: string
  style: PdfStyle
  size: number
  tone: PdfTone
  x: number
  /** baseline */
  y: number
  href?: string
}

export interface PdfRule {
  x1: number
  y1: number
  x2: number
  y2: number
  tone: PdfTone
  width: number
}

export interface PdfPage {
  runs: PdfRun[]
  rules: PdfRule[]
}

export interface LayoutConfig {
  pageWidth: number
  pageHeight: number
  marginX: number
  marginTop: number
  /** fundo da área útil — abaixo disso só o rodapé */
  marginBottom: number
}

/** A4 em pt (o jsPDF conta em pt) */
export const A4_LAYOUT: LayoutConfig = {
  pageWidth: 595.28,
  pageHeight: 841.89,
  marginX: 56,
  marginTop: 64,
  marginBottom: 76,
}

// ---------------------------------------------------------------------------
// toPdfSafe — sanitização WinAnsi (ver nota de encoding no topo)
// ---------------------------------------------------------------------------
/** chars > U+00FF COM código WinAnsi (CP1252 superior) — medidos no jsPDF 4.2.1 */
const WINANSI_UNICODE = new Set([
  0x0152,
  0x0153,
  0x0160,
  0x0161,
  0x0178,
  0x017D,
  0x017E,
  0x0192,
  0x02C6,
  0x02DC,
  0x2013,
  0x2014,
  0x2018,
  0x2019,
  0x201A,
  0x201C,
  0x201D,
  0x201E,
  0x2020,
  0x2021,
  0x2022,
  0x2026,
  0x2030,
  0x2039,
  0x203A,
  0x20AC,
  0x2122,
])

/** fallbacks tipográficos: char sem glifo WinAnsi → equivalente legível */
const WINANSI_FALLBACK = new Map<number, string>([
  [0x2212, '\u2013'], // menos tipográfico → travessão curto (o '−' do devDelta)
  [0x2009, ' '],
  [0x200A, ' '],
  [0x202F, ' '],
  [0x2032, '\''],
  [0x2033, '"'],
  [0x2035, '\''],
  [0x2036, '"'],
  [0x2190, '<-'],
  [0x2192, '->'],
  [0x2194, '<->'],
  [0x2264, '<='],
  [0x2265, '>='],
])

/**
 * Texto seguro para as fontes WinAnsi do jsPDF: mantém ASCII e Latin-1
 * (acentos renderizam), mapeia o que tem equivalente e descarta o resto
 * (emoji/CJK/fora do mapa — não há glifo na fonte padrão). O .md exportado
 * continua com os bytes originais; só o PDF normaliza.
 */
export function toPdfSafe(text: string): string {
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (code <= 0x7F) {
      // controles viram espaço, MAS as quebras de linha do markdown são
      // estruturais (separam blocos) e passam intactas
      out += code < 0x20 && char !== '\n' && char !== '\r' ? ' ' : char
      continue
    }
    if (code <= 0xFF) {
      out += char
      continue
    }
    if (WINANSI_UNICODE.has(code)) {
      out += char
      continue
    }
    out += WINANSI_FALLBACK.get(code) ?? ''
  }
  return out
}

// ---------------------------------------------------------------------------
// parse — o mesmo dialeto congelado do renderMarkdown (markdown.ts)
// ---------------------------------------------------------------------------
const ESCAPABLE = new Set(['\\', '`', '*', '_', '[', ']', '<', '>', '&'])
const LINK_AT = /\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)/y

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /\w/.test(char)
}

/** `(^|[^\w*])` do dialeto — o char anterior não fecha palavra nem é `*` */
function boldBoundaryBefore(prev: string | undefined): boolean {
  return prev === undefined || !/[\w*]/.test(prev)
}

/** `(?![\w*])` do dialeto */
function boldBoundaryAfter(next: string | undefined): boolean {
  return next === undefined || !/[\w*]/.test(next)
}

/** `(^|[\s(])` do dialeto */
function emBoundaryBefore(prev: string | undefined): boolean {
  return prev === undefined || /[\s(]/.test(prev)
}

/**
 * `\b` do dialeto: o `_` de fechamento é \w, então o limite existe quando o
 * próximo char NÃO é \w (inclusive fim de linha)
 */
function emBoundaryAfter(next: string | undefined): boolean {
  return !isWordChar(next)
}

/**
 * Linha do dialeto → spans com estilo. Mesma semântica do `inline` do
 * markdown.ts: escapes valem sempre, link só https (label com forte/ênfase),
 * `**forte**` e `_ênfase_` com as MESMAS fronteiras de palavra (snake_case e
 * repo#42_x ficam intactos). Aninhamento recursivo como no HTML do preview.
 */
export function parseInlineSpans(src: string, allowLinks = true): PdfSpan[] {
  const out: PdfSpan[] = []
  let buffer = ''

  const flush = () => {
    if (buffer) {
      out.push({ text: buffer, style: 'normal' })
      buffer = ''
    }
  }

  let i = 0
  while (i < src.length) {
    const char = src[i]

    // escape `\X` → literal X (o mdText escapa a fronteira de confiança)
    if (char === '\\' && i + 1 < src.length && ESCAPABLE.has(src[i + 1])) {
      buffer += src[i + 1]
      i += 2
      continue
    }

    // link `[label](https://…)` — href validado como no emissor
    if (allowLinks && char === '[') {
      LINK_AT.lastIndex = i
      const match = LINK_AT.exec(src)
      const href = match ? safeHttpsHref(match[2]) : null
      if (match && href) {
        flush()
        for (const span of parseInlineSpans(match[1], false))
          out.push({ ...span, href })
        i = LINK_AT.lastIndex
        continue
      }
    }

    // **forte** — fronteiras do dialeto, interior sem `*`
    if (char === '*' && src[i + 1] === '*' && boldBoundaryBefore(src[i - 1])) {
      const close = src.indexOf('**', i + 2)
      const inner = close > i + 2 ? src.slice(i + 2, close) : ''
      if (inner && !inner.includes('*') && boldBoundaryAfter(src[close + 2])) {
        flush()
        for (const span of parseInlineSpans(inner, allowLinks))
          out.push({ ...span, style: span.style === 'normal' ? 'bold' : span.style })
        i = close + 2
        continue
      }
    }

    // _ênfase_ — fronteiras do dialeto, interior sem `_`
    if (char === '_' && emBoundaryBefore(src[i - 1])) {
      const close = src.indexOf('_', i + 1)
      const inner = close > i + 1 ? src.slice(i + 1, close) : ''
      if (inner && emBoundaryAfter(src[close + 1])) {
        flush()
        for (const span of parseInlineSpans(inner, allowLinks))
          out.push({ ...span, style: span.style === 'normal' ? 'italic' : span.style })
        i = close + 1
        continue
      }
    }

    buffer += char
    i++
  }
  flush()
  return out
}

/**
 * Entrada do anexo (emissão `report.appendix.item`, idêntica nos 3 locales):
 * `- {link|hash} · {day} · {repo} · +{a}/-{d} · {scope} · {message}`. Os
 * campos de metadado têm formato fechado (data/diff) ou não contêm '·', então
 * o início da mensagem é inequívoco mesmo com '·' dentro dela. Formato fora do
 * padrão degrada para bullet comum (o PDF nunca perde linha).
 */
const COMMIT_ENTRY
  = /^(\[[^\]\n]*\]\(https:\/\/[^\s)]+\)|[^\s·]+) · (\d{4}-\d{2}-\d{2}) · ([^·]+) · (\+\d+\/-\d+) · ([^·]+) · ([\s\S]+)$/

/** markdown do dialeto → blocos (mesma gramática do renderMarkdown) */
export function parseReportBlocks(markdown: string): PdfBlock[] {
  const blocks: PdfBlock[] = []
  for (const line of markdown.split('\n')) {
    const bullet = /^- (.*)/.exec(line)
    if (bullet) {
      const entry = COMMIT_ENTRY.exec(bullet[1])
      if (entry) {
        blocks.push({
          kind: 'commitEntry',
          hash: parseInlineSpans(entry[1]),
          meta: parseInlineSpans(`${entry[2]} · ${entry[3]} · ${entry[4]} · ${entry[5]}`),
          message: parseInlineSpans(entry[6]),
        })
        continue
      }
      blocks.push({ kind: 'bullet', spans: parseInlineSpans(bullet[1]) })
      continue
    }
    const heading = /^(#{1,3}) (.*)/.exec(line)
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length as 1 | 2 | 3, spans: parseInlineSpans(heading[2]) })
      continue
    }
    if (line.trim())
      blocks.push({ kind: 'paragraph', spans: parseInlineSpans(line) })
  }
  return blocks
}

// ---------------------------------------------------------------------------
// wrap — quebra de linha por palavra preservando estilo, link e espaços
// ---------------------------------------------------------------------------
interface WrapWord {
  parts: PdfSpan[]
  spacesBefore: number
  spaceStyle: PdfStyle
}

function wordsOf(spans: PdfSpan[]): WrapWord[] {
  const words: WrapWord[] = []
  let current: PdfSpan[] = []
  let spaces = 0
  let spaceStyle: PdfStyle = 'normal'

  const push = () => {
    if (current.length) {
      words.push({ parts: current, spacesBefore: spaces, spaceStyle })
      current = []
      spaces = 0
    }
  }

  for (const span of spans) {
    const pieces = span.text.split(' ')
    pieces.forEach((piece, index) => {
      if (index > 0) {
        // fronteira de espaço fecha a palavra atual e passa a contar espaços
        push()
        spaces++
        spaceStyle = span.style
      }
      if (piece)
        current.push({ text: piece, style: span.style, href: span.href })
    })
  }
  push()
  return words
}

/**
 * Quebra greedy: a linha nunca passa de `maxWidth`; espaços na quebra somem
 * (o recuo do bullet já alinha as continuadas). Palavras com estilo misto
 * (`**abc**def`) não se separam no meio.
 */
export function wrapSpans(spans: PdfSpan[], maxWidth: number, measure: MeasureFn): PdfSpan[][] {
  const lines: PdfSpan[][] = []
  let line: WrapWord[] = []
  let width = 0

  const flushLine = () => {
    if (!line.length)
      return
    const spansOfLine: PdfSpan[] = []
    for (const word of line) {
      if (spansOfLine.length && word.spacesBefore)
        spansOfLine.push({ text: ' '.repeat(word.spacesBefore), style: word.spaceStyle })
      for (const part of word.parts) {
        const last = spansOfLine[spansOfLine.length - 1]
        if (last && last.style === part.style && last.href === part.href && last.tone === part.tone && last.size === part.size)
          last.text += part.text
        else
          spansOfLine.push({ ...part })
      }
    }
    lines.push(spansOfLine)
    line = []
    width = 0
  }

  for (const word of wordsOf(spans)) {
    const gap = line.length ? word.spacesBefore * measure(' ', word.spaceStyle) : 0
    const w = word.parts.reduce((total, part) => total + measure(part.text, part.style), 0)
    if (line.length && width + gap + w > maxWidth) {
      // palavra curta (o "9" de "9 devs ativos") nunca termina linha: desce
      // junto com a palavra atual quando as duas cabem na linha seguinte
      const last = line[line.length - 1]
      const lastText = last.parts.map(part => part.text).join('')
      const lastW = last.parts.reduce((total, part) => total + measure(part.text, part.style), 0)
      if (line.length >= 2 && lastText.length <= 2 && lastW + gap + w <= maxWidth) {
        line.pop()
        flushLine()
        line.push({ ...last, spacesBefore: 0 })
        width = lastW
      }
      else {
        flushLine()
      }
    }
    width += (line.length ? gap : 0) + w
    line.push(word)
  }
  flushLine()
  return lines
}

// ---------------------------------------------------------------------------
// layout — paginação pura (medida injetada); o render só desenha
// ---------------------------------------------------------------------------
interface BlockMetrics {
  size: number
  leading: number
  before: number
  after: number
  indent: number
  keepWithNext: boolean
  /** régua fina sob o bloco (título/seção) */
  rule?: 'title' | 'section'
}

/** variante de parágrafo: metadado (ênfase) · abertura (ata) · corpo */
type ParagraphVariant = 'body' | 'lead' | 'meta'

function metricsFor(block: PdfBlock, paragraph: ParagraphVariant = 'body'): BlockMetrics {
  if (block.kind === 'heading') {
    if (block.level === 1)
      return { size: 15, leading: 20, before: 0, after: 15, indent: 0, keepWithNext: true, rule: 'title' }
    if (block.level === 2)
      return { size: 12.5, leading: 16, before: 17, after: 8, indent: 0, keepWithNext: true, rule: 'section' }
    return { size: 10.5, leading: 14, before: 11, after: 4, indent: 0, keepWithNext: true }
  }
  if (block.kind === 'commitEntry')
    return { size: 10, leading: 12.8, before: 0, after: 5, indent: 13, keepWithNext: false }
  if (block.kind === 'bullet')
    return { size: 10, leading: 13.4, before: 0, after: 4, indent: 13, keepWithNext: false }
  if (paragraph === 'meta')
    return { size: 9.5, leading: 12.5, before: 0, after: 5, indent: 0, keepWithNext: false }
  if (paragraph === 'lead')
    return { size: 11, leading: 15, before: 3, after: 11, indent: 0, keepWithNext: false }
  return { size: 10, leading: 13.6, before: 0, after: 6, indent: 0, keepWithNext: false }
}

/**
 * Variante por bloco: linhas inteiramente em _ênfase_ são metadados
 * (gerado em…, janela em curso) e o primeiro parágrafo comum após o H1 é a
 * abertura (ata) — ambos ganham corpo/ritmo próprios.
 */
function variantOf(blocks: PdfBlock[]): ParagraphVariant[] {
  let leadPending = false
  return blocks.map((block) => {
    if (block.kind === 'heading') {
      leadPending = block.level === 1
      return 'body'
    }
    if (block.kind !== 'paragraph')
      return 'body'
    if (block.spans.length > 0 && block.spans.every(span => span.style === 'italic'))
      return 'meta'
    if (leadPending) {
      leadPending = false
      return 'lead'
    }
    return 'body'
  })
}

/**
 * Fluxo dos blocos em páginas: keep-with-next nos títulos (título nunca fica
 * sozinho no fim da página), espaçamento de antes colapsa no topo de página e
 * bloco que não cabe no resto da página inteira pula para a próxima — só
 * bloco maior que uma página inteira é fatiado linha a linha.
 */
export function layoutReport(blocks: PdfBlock[], measure: MeasureFn, cfg: LayoutConfig = A4_LAYOUT): PdfPage[] {
  const pages: PdfPage[] = []
  const contentWidth = cfg.pageWidth - 2 * cfg.marginX
  const pageBottom = cfg.pageHeight - cfg.marginBottom
  let page: PdfPage = { runs: [], rules: [] }
  let y = cfg.marginTop
  let used = false

  const newPage = () => {
    pages.push(page)
    page = { runs: [], rules: [] }
    y = cfg.marginTop
    used = false
  }

  const variants = variantOf(blocks)
  blocks.forEach((block, index) => {
    const m = metricsFor(block, variants[index])
    // linhas do bloco: a entrada do anexo vira metadado (menor, discreto) em
    // cima + mensagem em corpo — o bullet único de 6 campos virava parede
    let lines: PdfSpan[][]
    if (block.kind === 'commitEntry') {
      const meta: PdfSpan[] = block.hash.map(span => ({ ...span, size: 9, tone: span.href ? 'link' : 'muted' }))
      meta.push({ text: ` · ${block.meta.map(span => span.text).join('')}`, style: 'normal', size: 9, tone: 'muted' })
      lines = [meta, ...wrapSpans(block.message, contentWidth - m.indent, measure)]
    }
    else if (variants[index] === 'meta') {
      lines = wrapSpans(block.spans, contentWidth - m.indent, measure)
        .map(line => line.map(span => ({ ...span, tone: 'muted' as PdfTone })))
    }
    else {
      lines = wrapSpans(block.spans, contentWidth - m.indent, measure)
    }
    const height = lines.length * m.leading
    const before = used ? m.before : 0
    // keep-with-next: título + a primeira linha do bloco seguinte na mesma página
    const next = blocks[index + 1]
    const keep = m.keepWithNext && next ? metricsFor(next, variants[index + 1]).leading : 0

    if (used && y + before + height + m.after + keep > pageBottom)
      newPage()
    y += before

    const baselines: number[] = []
    for (const line of lines) {
      const baseline = y + m.size * 0.82
      baselines.push(baseline)
      emitLine(page, line, baseline, m, measure, cfg)
      y += m.leading
    }
    if ((block.kind === 'bullet' || block.kind === 'commitEntry') && baselines.length) {
      // bullet '•' na margem (glifo WinAnsi medido: 0x95)
      page.runs.push({ text: '\u2022', style: 'normal', size: m.size, tone: 'muted', x: cfg.marginX, y: baselines[0] })
    }
    if (m.rule && baselines.length) {
      const ruleY = baselines[baselines.length - 1] + (m.rule === 'title' ? 5.5 : 4.5)
      page.rules.push({
        x1: cfg.marginX,
        y1: ruleY,
        x2: cfg.pageWidth - cfg.marginX,
        y2: ruleY,
        tone: m.rule === 'title' ? 'ruleStrong' : 'rule',
        width: m.rule === 'title' ? 1 : 0.8,
      })
    }
    y += m.after
    used = true
  })
  pages.push(page)
  return pages
}

function emitLine(page: PdfPage, line: PdfSpan[], baseline: number, m: BlockMetrics, measure: MeasureFn, cfg: LayoutConfig): void {
  let x = cfg.marginX + m.indent
  for (const span of line) {
    page.runs.push({
      text: span.text,
      style: span.style,
      size: span.size ?? m.size,
      tone: span.tone ?? (span.href ? 'link' : 'ink'),
      x,
      y: baseline,
      href: span.href,
    })
    x += measure(span.text, span.style)
  }
}

// ---------------------------------------------------------------------------
// render — jsPDF (import dinâmico: o chunk só carrega na exportação)
// ---------------------------------------------------------------------------
export interface ReportPdf {
  /** bytes do PDF (buffer exato — pronto para o Blob do download) */
  data: Uint8Array<ArrayBuffer>
  pages: number
}

const TONE_RGB: Record<PdfTone, [number, number, number]> = {
  ink: [39, 39, 42],
  muted: [113, 113, 122],
  link: [29, 78, 216],
  rule: [188, 188, 196],
  ruleStrong: [161, 161, 170],
}

/** texto truncado com reticências para caber em `maxWidth` (rodapé) */
function truncateTo(text: string, maxWidth: number, measure: MeasureFn): string {
  if (measure(text, 'normal') <= maxWidth)
    return text
  let cut = text.length
  while (cut > 1 && measure(`${text.slice(0, cut - 1)}…`, 'normal') > maxWidth) cut--
  return `${text.slice(0, Math.max(cut - 1, 1))}…`
}

/**
 * Gera o PDF do relatório: tipografa o markdown em A4 com rodapé
 * "Página X de Y" (reportT — segue o locale do app), réguas de seção e links
 * clicáveis. `markdown` chega cru e é sanitizado UMA vez no parse (medida e
 * desenho veem o mesmo texto). Retorna os bytes + contagem de páginas.
 */
export async function buildReportPdf(markdown: string, opts: { title: string }): Promise<ReportPdf> {
  const { jsPDF: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ unit: 'pt', format: 'a4', compress: true })
  const setFont = (style: PdfStyle) => doc.setFont('helvetica', style)
  const measure: MeasureFn = (text, style) => {
    setFont(style)
    return doc.getTextWidth(text)
  }

  const blocks = parseReportBlocks(toPdfSafe(markdown))
  const pages = layoutReport(blocks, measure)
  const title = toPdfSafe(opts.title)

  pages.forEach((page, index) => {
    if (index > 0)
      doc.addPage()
    for (const rule of page.rules) {
      const [r, g, b] = TONE_RGB[rule.tone]
      doc.setDrawColor(r, g, b)
      doc.setLineWidth(rule.width)
      doc.line(rule.x1, rule.y1, rule.x2, rule.y2)
    }
    for (const run of page.runs) {
      const [r, g, b] = TONE_RGB[run.tone]
      setFont(run.style)
      doc.setFontSize(run.size)
      doc.setTextColor(r, g, b)
      if (run.href) {
        doc.textWithLink(run.text, run.x, run.y, { url: run.href })
        // sublinhado fino sob o link (a anotação já é clicável)
        doc.setDrawColor(...TONE_RGB.link)
        doc.setLineWidth(0.5)
        doc.line(run.x, run.y + 1.6, run.x + doc.getTextWidth(run.text), run.y + 1.6)
      }
      else {
        doc.text(run.text, run.x, run.y)
      }
    }
  })

  // rodapé em todas as páginas: título curto à esquerda, paginação à direita
  for (let i = 0; i < pages.length; i++) {
    doc.setPage(i + 1)
    const ruleY = A4_LAYOUT.pageHeight - 48
    doc.setDrawColor(...TONE_RGB.rule)
    doc.setLineWidth(0.6)
    doc.line(A4_LAYOUT.marginX, ruleY, A4_LAYOUT.pageWidth - A4_LAYOUT.marginX, ruleY)
    setFont('normal')
    doc.setFontSize(8)
    doc.setTextColor(...TONE_RGB.muted)
    doc.text(truncateTo(title, A4_LAYOUT.pageWidth * 0.55, measure), A4_LAYOUT.marginX, ruleY + 14)
    const pageLabel = reportT('report.pdf.footer.page', { page: i + 1, pages: pages.length })
    doc.text(pageLabel, A4_LAYOUT.pageWidth - A4_LAYOUT.marginX - doc.getTextWidth(pageLabel), ruleY + 14)
  }

  doc.setProperties({ title: opts.title })
  return { data: new Uint8Array(doc.output('arraybuffer')), pages: pages.length }
}
