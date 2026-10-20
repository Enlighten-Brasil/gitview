---
"gitview": patch
---

Novos scripts `collect:full` e `collect:reaggregate` no `package.json`: as flags `--full`/`--reaggregate` só eram alcançáveis rodando `tsx scripts/collect.ts` diretamente — um `pnpm collect -- --full` repassava a flag só ao último comando da cadeia (`check-data.ts`, que não a conhece). `collect:full` roda a mesma cadeia do `collect` com `--full` em `collect.ts` e `collect-github.ts` (os únicos que leem a flag); `collect:reaggregate` espelha o passo light do dev server (`collect.ts --reaggregate` + `collect-github.ts` incremental + `collect-team.ts` + `check-data.ts`, sem git scan nem releases/branches/graph). Docs (EN+pt-BR) alinhadas aos novos atalhos em collectors, development, maintenance e env, mais os READMEs.
