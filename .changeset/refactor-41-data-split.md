---
"gitview": minor
---

refactor(data): split do data.ts em filters/date/aggregations com reexports, agregações comuns (`groupBySum`/`nestBySum`, `commitsByRepoPeriod`, `commitsByAuthorWeek`, `fixByRepo`) que eliminam as varreduras repetidas de filteredMonthly/filteredWeekly nos componentes, e decomposição de devs/[name] (CommitsTimeline com prop `author`, `useDevCharts`, DevStatCards/DevPrOpen/DevCommitsTable) com blocos compartilhados (StatCards/DetailHeader) extraídos junto com repos/[name]. Comportamento e números inalterados.
