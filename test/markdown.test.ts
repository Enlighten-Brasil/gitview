import { describe, expect, it } from 'vitest'
import { mdLink, mdText, renderMarkdown } from '../src/markdown'

describe('mdText', () => {
  it('normaliza CR/LF e neutraliza markup antes de emitir o markdown', () => {
    expect(mdText('Ana <img src=x>\r\n**negrito** [link](javascript:alert(1)) &lt;tag&gt;'))
      .toBe('Ana \\<img src=x\\> \\*\\*negrito\\*\\* \\[link\\](javascript:alert(1)) \\&lt;tag\\&gt;')
    expect(mdText('linha 1\rlinha 2\nlinha 3')).toBe('linha 1 linha 2 linha 3')
    expect(mdText('`code` _em_ \\ *x*')).toBe('\\`code\\` \\_em\\_ \\\\ \\*x\\*')
  })

  it('preserva texto comum usado nos artefatos existentes', () => {
    expect(mdText('demo-api v1.0.0 repo#42 Ana')).toBe('demo-api v1.0.0 repo#42 Ana')
  })
})

describe('mdLink', () => {
  it('emite link HTTPS explícito, com query, e escapa o label', () => {
    expect(mdLink('abc[123]', 'https://github.com/example/repo/commit/abcdef0?a=1&b=2'))
      .toBe('[abc\\[123\\]](https://github.com/example/repo/commit/abcdef0?a=1&b=2)')
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'http://example.com/commit/abc',
    '//example.com/commit/abc',
    'https:example.com',
    'https://user:pass@example.com/commit/abc',
    '',
  ])('degrada URL inválida ou insegura para texto: %s', (url) => {
    expect(mdLink('abc<img>', url)).toBe('abc\\<img\\>')
  })

  it('neutraliza parênteses e controles no destino', () => {
    const link = mdLink('hash', 'https://example.com/a(b)?q=hello world')

    expect(link).toBe('[hash](https://example.com/a%28b%29?q=hello%20world)')
    expect(renderMarkdown(`- ${link}`)).toContain('href="https://example.com/a%28b%29?q=hello%20world"')
  })
})

describe('renderMarkdown', () => {
  it('renderiza H1/H2/H3 e o subconjunto inline existente', () => {
    const html = renderMarkdown('# Título\n## Seção\n### Dev\n- **5 commits** e _nota_')

    expect(html).toContain('<h1>Título</h1>')
    expect(html).toContain('<h2>Seção</h2>')
    expect(html).toContain('<h3>Dev</h3>')
    expect(html).toContain('<strong>5 commits</strong>')
    expect(html).toContain('<em>nota</em>')
    expect(renderMarkdown('#### fora do dialeto')).toBe('<p>#### fora do dialeto</p>')
  })

  it('renderiza somente links HTTPS com target e rel seguros', () => {
    const html = renderMarkdown('- [abcdef0](https://github.com/example/repo/commit/0123456789abcdef?a=1&b=2)')

    expect(html).toContain('<a href="https://github.com/example/repo/commit/0123456789abcdef?a=1&amp;b=2" target="_blank" rel="noopener noreferrer">abcdef0</a>')
  })

  it.each([
    '[x](javascript:alert(1))',
    '[x](data:text/html,evil)',
    '[x](http://example.com)',
    '[x](//example.com)',
    'https://example.com/autolink-nao-suportado',
  ])('não cria âncora para destino fora do dialeto: %s', (markdown) => {
    expect(renderMarkdown(markdown)).not.toContain('<a ')
  })

  it('renderiza campos hostis escapados como texto, sem XSS nem markup injetado', () => {
    const hostile = 'Ana <img src=x onerror=alert(1)> **admin** [x](javascript:alert(1)) &lt;script&gt;'
    const html = renderMarkdown(`### ${mdText(hostile)}\n- ${mdText('<script>alert(1)</script>')}`)

    expect(html).toContain('Ana &lt;img src=x onerror=alert(1)&gt; **admin** [x](javascript:alert(1)) &amp;lt;script&amp;gt;')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<strong>admin</strong>')
    expect(html).not.toContain('<a ')
  })

  it('preserva snake_case, repo#42_x e headings somente no início da linha', () => {
    const html = renderMarkdown('meio da linha # não vira heading\nrepo_snake_case e repo#42_x')

    expect(html).not.toMatch(/<h[123]>/)
    expect(html).toContain('repo_snake_case')
    expect(html).toContain('repo#42_x')
    expect(html).not.toContain('<em>')
  })
})
