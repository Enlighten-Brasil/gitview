---
'gitview': minor
---

refactor(charts): `useHeatmapMatrix` (composable em `src/charts/`) unifica a agregação em Map de chave composta → dados `[x, y, v]` → tooltip formatter → visualMap com `Math.max(max, 1)` → série heatmap dos 4 heatmaps (ActivityHeatmap, AuthorMonthHeatmap, RepoMonthHeatmap e o bloco de horários do perfil do dev), com `rows`/`xKey`/`yKey`/`ramp`/`order`/`formatTip`; `WEEKDAYS` vira constante canônica e `useWeekdayHourHeatmap` cobre os dois heatmaps dia-da-semana × hora. Visual dos 4 heatmaps preservado, incluindo o visualMap escondido do perfil do dev (agora parâmetro explícito e documentado)
