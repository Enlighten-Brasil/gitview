---
'gitview': minor
---

refactor(ui): `TablePanel` (wrapper de tabela com `ui` fixo) e `StatCard` + `.cards-grid` global unificam os wrappers/stat-cards copiados (RepoTable, PrOpenTable, DevTable, BusFactor, InactiveWatch, devs/[name], repos/[name], SummaryCards, PrSummaryCards) com grid/typo unificados, e `lastTagLabel(repo)` em `releases.ts` passa a ser o campo canônico (`tag`) da última release — tabela de repos e grade de releases mostram a mesma string
