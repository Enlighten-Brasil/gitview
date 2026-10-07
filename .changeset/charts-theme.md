---
"gitview": minor
---

Tema ECharts centralizado nos tokens do Nuxt UI: cores, tooltips e rampas de heatmap resolvem as CSS vars do design system em runtime (com conversão oklch→hex, já que canvas não suporta oklch) — trocar a cor primária no vite.config agora reflete em todos os gráficos. Paleta categórica única para séries. Ritmo vertical do layout uniforme (container com gap, sem margens soltas nos painéis) e divisores de seção ("saúde do time", "histórico").
