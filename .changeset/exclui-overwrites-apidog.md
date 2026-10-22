---
"gitview": minor
---

numstat: artefatos gerados restantes saem das métricas de linhas. `DEFAULT_EXCLUDE_PATHS` passa a excluir `overwrites/**` (cópias vendored de pacotes de terceiros) e `*.apidog.json` (export serializado do Apidog); `scripts/**` não entra — o conteúdo é misto e o gerador é fonte. Commits continuam contando; só as linhas saem — `GITVIEW_EXCLUDE_PATHS` segue como override aditivo. Retroativo: o histórico só reflete com `pnpm clean` + `pnpm collect:full` na janela de release.
