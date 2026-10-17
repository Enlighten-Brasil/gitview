---
'gitview': minor
---

refactor(stores): shallowRef + markRaw nos payloads dos loaders (stats/github/releases/team), predicados de filtro únicos em `src/filters-core.ts` (`cutoff`/`repoSelected`/`authorSelected` + janelas `inPeriodMonth`/`inPeriodDay`) e ações nomeadas em `data.ts` (`setRange`/`toggleRepo`/`lockAuthors`/`resetSelection`...) no lugar das mutações diretas de `filters` pelos componentes
