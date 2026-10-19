import type { DefaultTheme } from 'vitepress/theme'
import process from 'node:process'
import { defineConfig } from 'vitepress'

// Base do site de docs: em produção (GitHub Pages, project page) o site vive em
// https://enlighten-brasil.github.io/gitview/docs/, então o default é
// '/gitview/docs/'. Em dev local e no preview, os scripts do pacote exportam
// DOCS_BASE=/ para servir a partir da raiz.
const base = process.env.DOCS_BASE ?? '/gitview/docs/'

const repoUrl = 'https://github.com/Enlighten-Brasil/gitview'

// O vitepress 2.0.0-alpha.20 NÃO tem `siteUrl` (só `sitemap.hostname` resolve
// absolutos). As tags absolutas de SEO/OG são montadas a partir da base de
// produção fixa abaixo — em dev/preview (DOCS_BASE=/) as tags continuam
// apontando para o site publicado, que é o comportamento correto para
// crawlers e compartilhamento social.
const prodSiteUrl = 'https://enlighten-brasil.github.io/gitview/docs/'
const ogImageUrl = `${prodSiteUrl}og.png`

/** URL absoluta de uma página do dist (`configuration/env.md` → `.../gitview/docs/configuration/env.html`). */
function pageUrl(page: string): string | undefined {
  // a 404 gerada não deve entrar no índice social/canonical
  if (page === '404.md' || page === '404.html')
    return undefined
  // no alpha.20, `page` chega com a extensão da FONTE (.md); com cleanUrls
  // falso o arquivo real escrito no dist é .html
  const html = page.replace(/\.md$/, '.html')
  return prodSiteUrl + html.replace(/(^|\/)index\.html$/, '$1')
}

export default defineConfig<DefaultTheme.Config>({
  title: 'gitview docs',
  description: 'Documentation for gitview, simple git metrics for any team.',
  base,
  cleanUrls: false,
  // dark-first, como o app (o toggle de tema continua disponível)
  appearance: 'dark',

  // sitemap.xml no build: o hostname inclui o path da base (o `new URL(rel, hostname)`
  // do plugin exige a barra final para preservar `/gitview/docs/`)
  sitemap: {
    hostname: prodSiteUrl,
  },

  // Tags por página que o alpha.20 NÃO emite sozinho: og:title/og:description
  // específicos, og:url, canonical e twitter:title/description (mergeHead
  // sobrescreve os genéricos do `head` raiz quando a chave coincide).
  transformHead({ page, title, description }) {
    const url = pageUrl(page)
    if (!url)
      return
    return [
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:url', content: url }],
      ['link', { rel: 'canonical', href: url }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    ]
  },

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'gitview docs' }],
    ['meta', { property: 'og:title', content: 'gitview docs' }],
    ['meta', { property: 'og:description', content: 'Documentation for gitview, simple git metrics for any team.' }],
    ['meta', { property: 'og:image', content: ogImageUrl }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: ogImageUrl }],
  ],

  markdown: {
    image: { lazyLoad: true },
  },

  locales: {
    'root': {
      label: 'English',
      lang: 'en',
      title: 'gitview docs',
      description: 'Documentation for gitview, simple git metrics for any team.',
      // o alpha.20 faz merge do head por locale no HTML estático de cada rota
      head: [
        ['meta', { property: 'og:locale', content: 'en_US' }],
      ],
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
          {
            text: 'Reference',
            activeMatch: '/(configuration|dashboard)/',
            items: [
              { text: 'The .env file', link: '/configuration/env' },
              { text: 'Team config (team.local.json)', link: '/configuration/team' },
              { text: 'Data maintenance', link: '/configuration/maintenance' },
              { text: 'Filter rules', link: '/dashboard/filters' },
              { text: 'Metrics glossary', link: '/dashboard/metrics' },
            ],
          },
          {
            text: 'Contributing',
            activeMatch: '/(architecture|contributing)/',
            items: [
              { text: 'Development setup', link: '/contributing/development' },
              { text: 'Release ritual', link: '/contributing/release' },
              { text: 'Pipeline', link: '/architecture/pipeline' },
              { text: 'Collectors', link: '/architecture/collectors' },
              { text: 'Data model', link: '/architecture/data-model' },
            ],
          },
          { text: 'FAQ', link: '/faq' },
        ],
        sidebar: {
          '/guide/': [{
            text: 'Guide',
            base: '/guide/',
            items: [
              { text: 'Introduction', link: 'introduction' },
              { text: 'Quickstart', link: 'quickstart' },
              { text: 'The setup wizard', link: 'setup-wizard' },
              { text: 'Connecting GitHub', link: 'connecting-github' },
              { text: 'Repositories', link: 'repositories' },
              { text: 'Dashboard tour', link: 'tour' },
              { text: 'Publishing the static build', link: 'publishing' },
            ],
          }],
          '/configuration/': [{
            text: 'Configuration',
            base: '/configuration/',
            items: [
              { text: 'The .env file', link: 'env' },
              { text: 'Team config (team.local.json)', link: 'team' },
              { text: 'Data maintenance', link: 'maintenance' },
            ],
          }],
          '/dashboard/': [{
            text: 'Dashboard',
            base: '/dashboard/',
            items: [
              { text: 'Filter rules', link: 'filters' },
              { text: 'Metrics glossary', link: 'metrics' },
            ],
          }],
          '/architecture/': [{
            text: 'Architecture',
            base: '/architecture/',
            items: [
              { text: 'Pipeline', link: 'pipeline' },
              { text: 'Collectors', link: 'collectors' },
              { text: 'Data model', link: 'data-model' },
            ],
          }],
          '/contributing/': [{
            text: 'Contributing',
            base: '/contributing/',
            items: [
              { text: 'Development setup', link: 'development' },
              { text: 'Release ritual', link: 'release' },
            ],
          }],
        },
        outline: { label: 'On this page' },
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © Enlighten Brasil',
        },
      },
    },
    'pt-BR': {
      label: 'Português (Brasil)',
      lang: 'pt-BR',
      link: '/pt-BR/',
      title: 'gitview docs',
      description: 'Documentação do gitview, métricas de git simples para qualquer time.',
      head: [
        ['meta', { property: 'og:locale', content: 'pt_BR' }],
      ],
      themeConfig: {
        nav: [
          { text: 'Guia', link: '/pt-BR/guide/introduction', activeMatch: '/pt-BR/guide/' },
          {
            text: 'Referência',
            activeMatch: '/pt-BR/(configuration|dashboard)/',
            items: [
              { text: 'O arquivo .env', link: '/pt-BR/configuration/env' },
              { text: 'Config do time (team.local.json)', link: '/pt-BR/configuration/team' },
              { text: 'Manutenção dos dados', link: '/pt-BR/configuration/maintenance' },
              { text: 'Regras dos filtros', link: '/pt-BR/dashboard/filters' },
              { text: 'Glossário de métricas', link: '/pt-BR/dashboard/metrics' },
            ],
          },
          {
            text: 'Contribuição',
            activeMatch: '/pt-BR/(architecture|contributing)/',
            items: [
              { text: 'Ambiente de desenvolvimento', link: '/pt-BR/contributing/development' },
              { text: 'Ritual de release', link: '/pt-BR/contributing/release' },
              { text: 'Pipeline', link: '/pt-BR/architecture/pipeline' },
              { text: 'Coletores', link: '/pt-BR/architecture/collectors' },
              { text: 'Modelo de dados', link: '/pt-BR/architecture/data-model' },
            ],
          },
          { text: 'Perguntas frequentes', link: '/pt-BR/faq' },
        ],
        sidebar: {
          '/pt-BR/guide/': [{
            text: 'Guia',
            base: '/pt-BR/guide/',
            items: [
              { text: 'Introdução', link: 'introduction' },
              { text: 'Quickstart', link: 'quickstart' },
              { text: 'O wizard de configuração', link: 'setup-wizard' },
              { text: 'Conectando o GitHub', link: 'connecting-github' },
              { text: 'Repositórios', link: 'repositories' },
              { text: 'Passeio pelo dashboard', link: 'tour' },
              { text: 'Publicando o build estático', link: 'publishing' },
            ],
          }],
          '/pt-BR/configuration/': [{
            text: 'Configuração',
            base: '/pt-BR/configuration/',
            items: [
              { text: 'O arquivo .env', link: 'env' },
              { text: 'Config do time (team.local.json)', link: 'team' },
              { text: 'Manutenção dos dados', link: 'maintenance' },
            ],
          }],
          '/pt-BR/dashboard/': [{
            text: 'Dashboard',
            base: '/pt-BR/dashboard/',
            items: [
              { text: 'Regras dos filtros', link: 'filters' },
              { text: 'Glossário de métricas', link: 'metrics' },
            ],
          }],
          '/pt-BR/architecture/': [{
            text: 'Arquitetura',
            base: '/pt-BR/architecture/',
            items: [
              { text: 'Pipeline', link: 'pipeline' },
              { text: 'Coletores', link: 'collectors' },
              { text: 'Modelo de dados', link: 'data-model' },
            ],
          }],
          '/pt-BR/contributing/': [{
            text: 'Contribuição',
            base: '/pt-BR/contributing/',
            items: [
              { text: 'Ambiente de desenvolvimento', link: 'development' },
              { text: 'Ritual de release', link: 'release' },
            ],
          }],
        },
        outline: { label: 'Nesta página' },
        docFooter: { prev: 'Página anterior', next: 'Próxima página' },
        darkModeSwitchLabel: 'Aparência',
        lightModeSwitchTitle: 'Mudar para tema claro',
        darkModeSwitchTitle: 'Mudar para tema escuro',
        sidebarMenuLabel: 'Menu',
        returnToTopLabel: 'Voltar ao topo',
        navMenuLabel: 'Navegação principal',
        mobileMenuLabel: 'Menu',
        extraMenuLabel: 'Mais opções',
        footer: {
          message: 'Distribuído sob a licença MIT.',
          copyright: 'Copyright © Enlighten Brasil',
        },
      },
    },
  },

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'gitview' },
    socialLinks: [
      { icon: 'github', link: repoUrl },
    ],
    search: {
      provider: 'local',
      options: {
        locales: {
          'pt-BR': {
            translations: {
              button: {
                buttonText: 'Buscar',
                buttonAriaLabel: 'Buscar',
              },
              modal: {
                noResultsText: 'Nenhum resultado encontrado',
                resetButtonTitle: 'Limpar busca',
                footer: {
                  selectText: 'Selecionar',
                  navigateText: 'Navegar',
                  closeText: 'Fechar',
                },
              },
            },
          },
        },
      },
    },
  },
})
