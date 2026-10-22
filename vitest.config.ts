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
 * Sem thresholds nesta issue: o floor é issue própria, depois da baseline.
 */
export default defineConfig({
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
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts'],
    },
  },
})
