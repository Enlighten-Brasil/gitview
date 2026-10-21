---
"gitview": minor
---

numstat: artefatos gerados saem das métricas de linhas. `DEFAULT_EXCLUDE_PATHS` passa a excluir `dist/**`, `documentation/**` e `full_documentation.json` (commits continuam contando; só as linhas saem) — `GITVIEW_EXCLUDE_PATHS` segue como override aditivo. Retroativo: o histórico só reflete com `pnpm clean` + `pnpm collect:full` na janela de release.
