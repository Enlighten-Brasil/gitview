---
"gitview": patch
---

Corrige o vínculo de snapshot do anexo de relatórios: `daily.json` passa a compartilhar o `generatedAt` do `stats.json` (antes carimbava o próprio, divergia por milissegundos e bloqueava exportação/impressão com "anexo bloqueado por divergência entre snapshots"). `check-data` ganha assert bloqueante do vínculo para impedir regressão.
