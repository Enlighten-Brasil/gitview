import antfu from '@antfu/eslint-config'
import pluginVueI18n from '@intlify/eslint-plugin-vue-i18n'

/**
 * Padrão de lint do maintainer do gitview (espelhado direto aqui porque o
 * projeto é MIT/open-source e não pode depender de pacote privado): antfu com
 * markdown off, as regras default do time e os ignores de código gerado/dados
 * locais.
 */
export default antfu(
  {
    markdown: false,
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      // dados gerados pelos coletores (locais, regeneráveis)
      'public/data/**',
      'data/**',
      // cache do build do VitePress (site de docs, regenerável)
      '**/.vitepress/cache/**',
      // arquivos de tipos gerados pelo tooling (o route-map é gerado e commitado)
      'src/route-map.d.ts',
      'auto-imports.d.ts',
      'components.d.ts',
    ],
    rules: {
      'ts/consistent-type-definitions': ['error', 'interface'],
      'vue/custom-event-name-casing': 'off',
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/component-name-in-template-casing': ['error', 'PascalCase', {
        registeredComponentsOnly: false,
        ignores: ['/^i-/'],
      }],
      // exceções de vue do padrão do maintainer do gitview:
      // os editors de draft mutam objetos do pai de propósito (barra sticky de gravação)
      'vue/no-mutating-props': 'off',
      'vue/prefer-separate-static-class': 'off',
    },
  },
  // gate de copy padronizado (#254): @intlify/eslint-plugin-vue-i18n.
  // localeDir aponta src/locales (nasce na #252); sem o catálogo presente o
  // plugin não quebra — no-missing-keys/no-unused-keys só mordem quando ele existe.
  ...pluginVueI18n.configs['flat/recommended'],
  {
    settings: {
      'vue-i18n': {
        localeDir: './src/locales/**/*.{json,yaml,yml}',
        // silencia o no-deprecated-modulo-syntax sem versão declarada (avisa
        // em todo catálogo); a sintaxe usada é a do vue-i18n v11
        messageSyntaxVersion: '^11.0.0',
      },
    },
    rules: {
      '@intlify/vue-i18n/no-missing-keys': 'error',
      // 'ignores' do plugin é alavanca morta (medido: nenhum padrão silencia) —
      // o caso dinâmico do nav vai no bloco scoped abaixo; reavaliar na #265
      '@intlify/vue-i18n/no-unused-keys': 'error',
      // no-raw-text fica em warn nesta onda; a graduação para error é a #265
      '@intlify/vue-i18n/no-raw-text': 'warn',
    },
  },
  {
    // chaves de nav consumidas dinamicamente via t(s.label) nos componentes
    // (mapa src/nav.ts) — o plugin não rastreia uso dinâmico e marcaria todas
    // como unused; desligado só nos nav.json, as demais chaves (estáticas em
    // t('literal')) continuam sob a regra. Reavaliar na convenção final (#265)
    files: ['src/locales/*/nav.json'],
    rules: {
      '@intlify/vue-i18n/no-unused-keys': 'off',
    },
  },
  {
    // chaves de filters.json sem rastreio do plugin: os chips de período e de
    // escopo resolvem a chave por value (mapa estático em FilterBar.vue) e o
    // rangeLabel chama t() fora de componente (composer global em src/filters.ts)
    // — desligado só nos filters.json, as demais chaves (estáticas em
    // t('literal')) continuam sob a regra. Reavaliar na convenção final (#265)
    files: ['src/locales/*/filters.json'],
    rules: {
      '@intlify/vue-i18n/no-unused-keys': 'off',
    },
  },
)
