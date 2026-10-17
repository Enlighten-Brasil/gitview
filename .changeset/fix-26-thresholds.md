---
'gitview': patch
---

fix(alerts): centraliza os limiares de negócio em `src/thresholds.ts` e unifica valores divergentes entre painéis (issue #26). Os mesmos conceitos tinham números diferentes em componentes que deveriam mostrar a mesma métrica; agora tudo importa as constantes nomeadas do módulo único (rótulos de UI interpolam as constantes):

- `PACE_FALLING = 0.5` — o alerta da Visão geral (AlertStrip) sai de 0.6 e passa a usar o mesmo limiar do painel Ritmo (PaceAlert, que prevalece)
- `PR_STALE_DAYS = 14` — o card do PrSummaryCards migra de 7d para a janela de 14d (mesmo critério de `>=` do `stalePrs`, do PrStaleAlert e do resumo semanal)
- `MERGE_NO_REVIEW_RED = 0.2` / `MERGE_NO_REVIEW_AMBER = 0.1` — o card "mergeados sem review" do PrSummaryCards troca o erro em >50% pela escala 20%/10% do ReviewCoverage
- `DEV_STALE_DAYS = 21` + filtro `!isBot()` no AlertStrip — o alerta de inatividade passa a contar só devs (igual ao InactiveWatch) e bate com a lista do /health
- demais limiares viram constantes importadas sem mudança de comportamento: fix hotspot 35%/25% (+ amostra mínima 20), commits não liberados 20/50, off-hours 25%/3 fds (com bandas de atenção 15%/5 e mínimos de commits do período e da semana), inatividade de repo 30d (bandas de erro 60d/90d) e release atrasada 30d
