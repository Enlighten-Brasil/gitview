/**
 * Renderer do markdown do relatório (issue #186) — o emissor (report.ts) tem
 * dialeto pequeno e congelado (issue #184): H1 `# `, H2 `## `, bullets `- `,
 * `**bold**` e `_itálico_`; nada de tabela GFM, H3 ou links.
 *
 * ponytail: teto = o dialeto congelado da issue #184 (renderer de subconjunto);
 * upgrade = marked + sanitize quando o emissor crescer.
 *
 * Trust boundary: nomes de dev/time vêm do team.local.json (input do usuário)
 * e são interpolados no markdown — por isso ESCAPE-FIRST (`&`, `<`, `>`) antes
 * dos regex inline: nome malicioso renderiza como texto, nunca como HTML.
 */

/** escapa a fronteira de confiança ANTES de qualquer regex inline */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** inline non-greedy com borda de palavra — `repo#42_x` e `snake_case` intactos */
function inline(s: string): string {
  return escapeHtml(s)
    .replace(/(^|[^\w*])\*\*([^*]+)\*\*(?![\w*])/g, '$1<strong>$2</strong>')
    .replace(/(^|[\s(])_([^_]+)_\b/g, '$1<em>$2</em>')
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
    const heading = /^(#{1,2}) (.*)/.exec(line)
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
