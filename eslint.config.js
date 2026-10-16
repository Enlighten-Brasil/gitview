import antfu from '@antfu/eslint-config'

/**
 * Padrão example/example de lint (mesma base do @example-org/eslint-config
 * interno, espelhada aqui direto porque o gitview é MIT/open-source e não pode
 * depender de pacote privado): antfu com markdown off, as regras default do
 * time e os ignores de código gerado/dados locais.
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
      // mesmas exceções de vue do padrão example (example/eslint.config.js):
      // os editors de draft mutam objetos do pai de propósito (barra sticky de gravação)
      'vue/no-mutating-props': 'off',
      'vue/prefer-separate-static-class': 'off',
    },
  },
)
