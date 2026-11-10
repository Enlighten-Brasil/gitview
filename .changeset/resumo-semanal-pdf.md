---
"gitview": minor
---

feat(relatorios): resumo semanal exporta o PDF nativo pela composable compartilhada

O slideover do resumo semanal ganha o botão baixar .pdf (grava resumo-<weekKey>.pdf), pela nova composable usePdfExport compartilhada com o /reports — mesmo motor de PDF (A4 tipografado, paginação real, rodapé Página X de Y) e mesmos toasts do padrão 0.46. O título do documento sai do H1 do próprio markdown. Contratos de teste cobrem as duas superfícies; README e docs/guide/tour.md atualizados nos pares EN/pt-BR.