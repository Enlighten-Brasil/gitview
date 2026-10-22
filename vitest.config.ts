import { defineConfig } from 'vitest/config'

/**
 * Config do Vitest (issue #248) — STANDALONE, não derivado do `vite.config.ts`:
 * lá dentro ficam os plugins pesados do build e o `loadConfig()` do Vite tem
 * efeito colateral (cria o `.env`). O config de teste fica limpo e CI-safe.
 *
 * API de configuração: `test.projects` — recomendada desde o Vitest 3.2, o
 * `vitest.workspace.ts` está deprecado. Hoje há UM projeto (node puro); o
 * projects abre caminho p/ um 2º projeto (componentes + happy-dom) sem mexer
 * no config raiz. `coverage` é opção de RAIZ (nunca de projeto).
 *
 * Floor de cobertura por escopo (issue #251): thresholds por glob agregam os
 * arquivos do padrão (NÃO são por-arquivo) — os dois pisos abaixo cobrem só os
 * módulos testados em #249/#250, ~4-6pp abaixo da baseline medida (src 95.71%,
 * scripts/lib 63.57% em 22/10/2026). Sem chave global: os ~80 arquivos de copy
 * fora de escopo ficam no relatório sem floor. clean.ts e log.ts entram no
 * include (visíveis a 0%) mas ficam fora dos padrões (nunca foram alvo).
 */
export default defineConfig({
  resolve: {
    alias: {
      // espelha o alias do vite.config.ts: petite-vue-i18n é o subconjunto
      // usado no app; sem isso o import 'vue-i18n' não resolve no Vitest
      'vue-i18n': 'petite-vue-i18n',
    },
  },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['test/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts', 'scripts/lib/**/*.ts'],
      exclude: ['**/*.d.ts'],
      thresholds: {
        'src/{aggregations,branches,filters-core,format,loader,report,thresholds,urlState,graph/lanes,graph/refs}.ts': {
          statements: 90,
        },
        'scripts/lib/{config,github,refs,repos,scope,team}.ts': {
          statements: 60,
        },
      },
    },
  },
})
