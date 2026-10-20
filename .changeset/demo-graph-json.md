---
'gitview': minor
---

Os dados sintéticos da demo pública passam a incluir o grafo de commits: o `make-demo-data.ts` gera `graph-demo-api.json` e `graph-demo-web.json` no shape do contrato do coletor, com hashes 40-hex determinísticos consistentes com os tips do `branches.json` e os `headRefOid` dos PRs demo, 2-3 merges por repo (junções de lanes visíveis), exatamente uma aresta clipada por repo (pai fora da janela, desenhada com o marcador "continua") e refs nos tips das branches e em tags. O novo script `pnpm demo` gera o fixture completo (8 JSONs) e as docs do grafo deixam de documentar o empty-state como limitação da demo.
