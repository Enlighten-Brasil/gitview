---
'gitview': minor
---

Novo filtro de escopo de trabalho no núcleo dos filtros — `filters.workScope` (`all` | `prod` | `progress`, default `all`), com a ação nomeada `setWorkScope` (porta única de escrita) e o predicado único `scopeMatches(row)` na codificação omit-prod dos dados (linha sem `scope` = produção; `progress` agrupa integration + branch). O predicado vale nas 4 projeções filtradas (weekly/monthly/heatmap/types) e nos 3 iteradores diretos de `previousTotals`, `pace` e `burnout` — as derivadas (totais, contagens, commits por autor/repo, fora do horário) herdam das projeções. O estado sincroniza com a URL via `?scope=` (enum fechado; valor inválido cai em `all`; default omitido), persiste em localStorage (`gitview:scope`), reseta no voltar/avançar sem arrastar contexto de outra entrada e é forçado a `all` em dados anteriores à divisão prod/progress (feature-detect de `totals.prodCommits`). Os iteradores de página e a UI (chips/cards/rodapés) vêm na próxima issue.
