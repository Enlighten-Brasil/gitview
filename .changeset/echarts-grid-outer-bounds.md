---
'gitview': patch
---

Migra `grid.containLabel` para o API do ECharts 6 nos 4 gráficos afetados (CommitTypes, PrCycleTime, PrReviews e "Commits por dev" de /repos/:name): `outerBoundsMode: 'same'` + `outerBoundsContain: 'axisLabel'`, o equivalente oficial documentado — mesma projeção de layout de antes, sem o aviso `LegacyGridContainLabel` no console.
