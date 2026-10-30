---
"gitview": minor
---

feat(filtros): sidebar redimensionavel, atalhos de semana e calendario no range custom

- Painel contextual redimensionavel (arraste na borda ou setas, 220-520px, persistido em
  localStorage; default 280px) — antes largura fixa de 232px.
- Atalhos de periodo curto na sidebar: 7 dias / esta semana / semana passada — materializados
  como from/to (URL compartilhavel), com atalho ativo derivado das datas.
- Range custom ganha UCalendar range em UPopover (padrao Nuxt UI) no lugar dos inputs
  nativos que nao cabiam; nova dependencia @internationalized/date.
- inPeriodMonth: range custom agora corta semana por SEMANA (buckets inteiros por
  intersectar a janela) — antes o corte mensal engolia semanas vizinhas. Presets mensais
  mantem o corte por mes documentado.
