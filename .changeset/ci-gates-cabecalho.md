---
"gitview": patch
---

O comentário de cabeçalho do `.github/workflows/ci.yml` passa a espelhar os gates na ordem real de execução dos steps (`pnpm check:scrub` → `pnpm lint` → `pnpm typecheck` → `pnpm build`), corrigindo a lista defasada que omitia o `check:scrub`, o primeiro gate do job `gates`. Apenas as linhas de comentário do topo foram reescritas — a explicação do job `docs` e a do `check:data` deliberadamente fora do CI foram preservadas, e nenhum step do workflow foi alterado.
