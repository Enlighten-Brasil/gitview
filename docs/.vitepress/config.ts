import type { DefaultTheme } from 'vitepress/theme'
import process from 'node:process'
import { defineConfig } from 'vitepress'

// Base do site de docs: em produção (GitHub Pages, project page) o site vive em
// https://enlighten-brasil.github.io/gitview/docs/, então o default é
// '/gitview/docs/'. Em dev local e no preview, os scripts do pacote exportam
// DOCS_BASE=/ para servir a partir da raiz.
const base = process.env.DOCS_BASE ?? '/gitview/docs/'

const repoUrl = 'https://github.com/Enlighten-Brasil/gitview'

export default defineConfig<DefaultTheme.Config>({
  title: 'gitview docs',
  description: 'Documentation for gitview, the open-source git & GitHub metrics dashboard.',
  base,
  cleanUrls: false,
  // dark-first, como o app (o toggle de tema continua disponível)
  appearance: 'dark',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}favicon.svg` }],
    ['meta', { property: 'og:title', content: 'gitview docs' }],
    ['meta', { property: 'og:description', content: 'Documentation for gitview, the open-source git & GitHub metrics dashboard.' }],
  ],

  markdown: {
    image: { lazyLoad: true },
  },

  locales: {
    'root': {
      label: 'English',
      lang: 'en',
      title: 'gitview docs',
      description: 'Documentation for gitview, the open-source git & GitHub metrics dashboard.',
      themeConfig: {
        nav: [
          { text: 'Guide', link: '/guide/introduction', activeMatch: '/guide/' },
          { text: 'Configuration', link: '/configuration/env', activeMatch: '/configuration/' },
          { text: 'Dashboard', link: '/dashboard/tour', activeMatch: '/dashboard/' },
          { text: 'Architecture', link: '/architecture/pipeline', activeMatch: '/architecture/' },
          { text: 'Publishing', link: '/publishing/static-deploy', activeMatch: '/publishing/' },
          { text: 'Contributing', link: '/contributing/development', activeMatch: '/contributing/' },
          { text: 'FAQ', link: '/faq' },
        ],
        sidebar: {
          '/guide/': [{
            text: 'Guide',
            base: '/guide/',
            items: [
              { text: 'Introduction', link: 'introduction' },
              { text: 'Quickstart', link: 'quickstart' },
              { text: 'Setup wizard', link: 'setup-wizard' },
              { text: 'Connecting GitHub', link: 'connecting-github' },
              { text: 'Repositories', link: 'repositories' },
            ],
          }],
          '/configuration/': [{
            text: 'Configuration',
            base: '/configuration/',
            items: [
              { text: 'Environment variables', link: 'env' },
              { text: 'Team', link: 'team' },
              { text: 'Maintenance', link: 'maintenance' },
            ],
          }],
          '/dashboard/': [{
            text: 'Dashboard',
            base: '/dashboard/',
            items: [
              { text: 'Tour', link: 'tour' },
              { text: 'Filters', link: 'filters' },
              { text: 'Metrics', link: 'metrics' },
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
          '/publishing/': [{
            text: 'Publishing',
            base: '/publishing/',
            items: [
              { text: 'Static deploy', link: 'static-deploy' },
            ],
          }],
          '/contributing/': [{
            text: 'Contributing',
            base: '/contributing/',
            items: [
              { text: 'Development', link: 'development' },
              { text: 'Release process', link: 'release' },
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
      description: 'Documentação do gitview, o dashboard open-source de métricas de git e GitHub.',
      themeConfig: {
        nav: [
          { text: 'Guia', link: '/pt-BR/guide/introduction', activeMatch: '/pt-BR/guide/' },
          { text: 'Configuração', link: '/pt-BR/configuration/env', activeMatch: '/pt-BR/configuration/' },
          { text: 'Dashboard', link: '/pt-BR/dashboard/tour', activeMatch: '/pt-BR/dashboard/' },
          { text: 'Arquitetura', link: '/pt-BR/architecture/pipeline', activeMatch: '/pt-BR/architecture/' },
          { text: 'Publicação', link: '/pt-BR/publishing/static-deploy', activeMatch: '/pt-BR/publishing/' },
          { text: 'Contribuição', link: '/pt-BR/contributing/development', activeMatch: '/pt-BR/contributing/' },
          { text: 'FAQ', link: '/pt-BR/faq' },
        ],
        sidebar: {
          '/pt-BR/guide/': [{
            text: 'Guia',
            base: '/pt-BR/guide/',
            items: [
              { text: 'Introdução', link: 'introduction' },
              { text: 'Início rápido', link: 'quickstart' },
              { text: 'Assistente de configuração', link: 'setup-wizard' },
              { text: 'Conectando o GitHub', link: 'connecting-github' },
              { text: 'Repositórios', link: 'repositories' },
            ],
          }],
          '/pt-BR/configuration/': [{
            text: 'Configuração',
            base: '/pt-BR/configuration/',
            items: [
              { text: 'Variáveis de ambiente', link: 'env' },
              { text: 'Time', link: 'team' },
              { text: 'Manutenção', link: 'maintenance' },
            ],
          }],
          '/pt-BR/dashboard/': [{
            text: 'Dashboard',
            base: '/pt-BR/dashboard/',
            items: [
              { text: 'Tour', link: 'tour' },
              { text: 'Filtros', link: 'filters' },
              { text: 'Métricas', link: 'metrics' },
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
          '/pt-BR/publishing/': [{
            text: 'Publicação',
            base: '/pt-BR/publishing/',
            items: [
              { text: 'Deploy estático', link: 'static-deploy' },
            ],
          }],
          '/pt-BR/contributing/': [{
            text: 'Contribuição',
            base: '/pt-BR/contributing/',
            items: [
              { text: 'Desenvolvimento', link: 'development' },
              { text: 'Processo de release', link: 'release' },
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
