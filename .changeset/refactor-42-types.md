---
'gitview': minor
---

refactor(types): union fechadas e envelopes tipados — `MergedPr` (`PullRequest & { mergedAt: string }` + `isMergedPr`) nos computeds de PRs mergeados eliminando os `!` de `mergedAt` (github.ts, summary.ts, repos/[name], DevStatCards); `PrReview.state` com union fechada (`PrReviewState`, valores do enum `PullRequestReviewState`) validada no check-data; envelopes `SseLine`/`SseStep`/`SseError` tipados em `sse.ts` com parse em try/catch (payload malformado nunca lança dentro do handler); `FilterScope` exportado só de `router/meta.ts` (antes 3×); `DETAIL_ROUTES` tipado como `Set<RouteName>` contra o `route-map.d.ts` gerado (typo de rota quebra o typecheck); helper `getOrCreate(map, key, init)` no lugar do padrão `map.get(k)!` em src e scripts — zero non-null assertions restantes no projeto (templates pré-compostos em CycleTrend/DevCommitsTable/PaceAlert, que ficam fora do typecheck)
