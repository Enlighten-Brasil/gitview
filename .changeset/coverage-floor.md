---
'gitview': patch
---

Coverage floor por escopo (issue #251): o `vitest.config.ts` passa a travar 90% de statements no agregado dos módulos de `src/` testados em #249 e 60% no agregado das libs de `scripts/lib/` testadas em #250, com o include de coverage estendido para `scripts/lib/**/*.ts` (clean.ts e log.ts visíveis no relatório, fora dos pisos). Novo script `pnpm test:coverage`, que o job `test` do CI passa a rodar — queda de cobertura nos módulos-alvo agora quebra o build.
