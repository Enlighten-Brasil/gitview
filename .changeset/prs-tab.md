---
'gitview': minor
---

Nova aba "Pull requests" com dados do GitHub (coletados via `gh api graphql` em `public/data/github.json`): cards (abertos, parados +7 dias, mergeados no período, cycle time mediano, % sem review), tabela de PRs abertos ordenada por idade com link pro GitHub, cycle time mediano por repo e reviews por dev (aprovações/pedidos de mudança/comentários). Respeita todos os filtros da sidebar e a URL (?tab=prs). Coletor novo: `pnpm collect:github` (encadeado no `pnpm collect`); mapeamento login→dev em `config.githubUsers` e bots em `config.githubBots`. Tema de gráficos ganhou error500/warning500.
