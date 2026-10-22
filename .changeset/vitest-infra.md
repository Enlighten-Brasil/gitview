---
'gitview': minor
---

Infra de testes com Vitest 5.0.5: scripts `pnpm test` (modo run) e `pnpm test:watch`, config em `vitest.config.ts` standalone com a API `test.projects` (um projeto node; workspace `.ts` está deprecado desde o 3.2) e coverage v8 com relatório, sem floor por enquanto. Sementes em `test/` cobrindo dois módulos puros — `src/graph/lanes.ts` (regras R1–R8 do grafo de commits) e `src/date.ts` (semana ISO) — com fixtures inline, sem ler dados gitignored, então o job `test` novo no CI roda em clone limpo. Convenção documentada nos dois pares de CONTRIBUTING: lógica nova não-trivial nasce com teste e `pnpm test` passa a ser gate.
