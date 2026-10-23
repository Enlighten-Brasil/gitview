---
"gitview": minor
---

numstat: scratch do git filter-branch sai das métricas de linhas. `DEFAULT_EXCLUDE_PATHS` passa a excluir `.git-rewrite/**` (artefato da ferramenta commitado por engano num repo — 59k de additions em 2 commits); `themes/**` e `content/**` avaliados e recusados — conteúdo misto: temas/SCSS/fontes autorados em `src/**/themes` e documentação autoral em `content/`/`docs/**/content/` convivem com material vendorizado/demo nos mesmos diretórios. Commits continuam contando; só as linhas saem — `GITVIEW_EXCLUDE_PATHS` segue como override aditivo. Retroativo: o histórico só reflete com `pnpm clean` + `pnpm collect` na janela de release.
