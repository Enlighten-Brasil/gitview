---
'gitview': patch
---

Endurece o gate `pnpm check:scrub` nas duas arestas de fail-open apontadas na revisão independente do batch: `git ls-files -z` (nomes crus, sem quoting — path com espaço nas pontas ou não-ASCII não vira "outro arquivo" e não escapa do scan pelo catch) e `console.warn` em leitura que falhar, em vez de `continue` silencioso. `maxBuffer` explicitado (32 MiB) para o limite padrão de 1 MB do `execSync` não estourar silenciosamente em repo grande. Validado nos dois sentidos: 121 arquivos limpos / termo injetado em arquivo tracked → exit 1 com arquivo:linha e termo.
