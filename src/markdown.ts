/**
 * Emissor e renderer do dialeto pequeno de Markdown dos relatórios.
 * Campos dinâmicos passam por mdText; links explícitos passam por mdLink.
 * O preview continua escape-first e nunca aceita HTML arbitrário.
 */

/** Texto inline seguro para o emissor: uma linha, sem markup herdado do campo. */
export function mdText(value: string): string {
  return value
    .replace(/\r\n?|\n/g, ' ')
    .replace(/[\\`*_[\]<>&]/g, '\\$&')
}

function safeHttpsHref(value: string): string | null {
  const hasControl = Array.from(value).some((char) => {
    const code = char.codePointAt(0) ?? 0
    return code <= 0x1F || code === 0x7F
  })
  if (!/^https:\/\//i.test(value) || hasControl)
    return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password)
      return null
    return url.href.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/\\/g, '%5C')
  }
  catch {
    return null
  }
}

/** Link HTTPS explícito; destino inválido vira somente o label escapado. */
export function mdLink(label: string, href: string): string {
  const safeHref = safeHttpsHref(href)
  return safeHref ? `[${mdText(label)}](${safeHref})` : mdText(label)
}

/** escapa a fronteira de confiança ANTES de qualquer regex inline */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const TOKEN_RE = /\uE000(\d+)\uE001/g

/** inline non-greedy com borda de palavra — `repo#42_x` e `snake_case` intactos */
function inline(s: string, allowLinks = true, tokens: string[] = []): string {
  const stash = (html: string): string => {
    const index = tokens.push(html) - 1
    return `\uE000${index}\uE001`
  }
  let source = s.replace(/\\([\\`*_[\]<>&])/g, (_match, char: string) => stash(escapeHtml(char)))
  if (allowLinks) {
    source = source.replace(/\[([^\]\n]*)\]\((https:\/\/[^\s)]+)\)/g, (_match, label: string, href: string) => {
      const safeHref = safeHttpsHref(href)
      if (!safeHref)
        return _match
      return stash(`<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${inline(label, false, tokens)}</a>`)
    })
  }
  return escapeHtml(source)
    .replace(/(^|[^\w*])\*\*([^*]+)\*\*(?![\w*])/g, '$1<strong>$2</strong>')
    .replace(/(^|[\s(])_([^_]+)_\b/g, '$1<em>$2</em>')
    .replace(TOKEN_RE, (_match, index: string) => tokens[Number(index)] ?? '')
}

/** markdown do dialeto congelado → HTML (heading só em início de linha) */
export function renderMarkdown(md: string): string {
  const out: string[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      out.push(`<ul>${list.join('')}</ul>`)
      list = []
    }
  }
  for (const line of md.split('\n')) {
    const bullet = /^- (.*)/.exec(line)
    if (bullet) {
      list.push(`<li>${inline(bullet[1])}</li>`)
      continue
    }
    flush()
    const heading = /^(#{1,3}) (.*)/.exec(line)
    if (heading) {
      const level = heading[1].length
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }
    if (line.trim())
      out.push(`<p>${inline(line)}</p>`)
  }
  flush()
  return out.join('\n')
}
