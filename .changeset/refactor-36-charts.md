---
'gitview': minor
---

refactor(charts): unifica `donutBase()`, `RiskBar.vue` + `statusOf()`, `PrLinkCell.vue` e `COMMIT_TYPES`/`commitTypeColor()` — as configs de donut (3 cópias), o padrão "risk bar" (5 cópias), a célula de link de PR (3 cópias) e as categorias/cores de commit (2 cópias) tinham uma só implementação cada. `ChartPanel` ganha empty state para gráfico sem dados e exporta PNG via ref do `VChart` (sem seletor de atributo interno do ECharts), com toast de sucesso/falha. `oklchToHex` cobre `none`/unidades de matiz/alpha e devolve fallback hex (nunca vaza `oklch(` cru), com `resetThemeCache()` documentado e helpers tipados com os tipos ECharts.
