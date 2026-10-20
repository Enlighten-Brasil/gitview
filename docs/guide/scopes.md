---
title: Production vs progress
description: "The work-scope view for managers: what production and in-progress mean, which panels follow the scope, which fixed windows ignore it and the known limitations."
---

# Production vs progress

Every commit line gitview collects is classified against the repository refs at collection time: it is either reachable from the **production ref** (released work) or it lives on an **integration** branch or another **branch** (work in progress). The scope filter in the sidebar — the **Todos**, **Produção** and **Em progresso** chips — turns that classification into three views over the same data. The default is **Todos**; the choice travels in the URL as `?scope=prod` or `?scope=progress` and persists across navigation.

## What each scope shows

| Chip | `?scope=` | What counts |
|---|---|---|
| **Todos** | (omitted) | every commit line — the default, the numbers everyone is used to |
| **Produção** | `prod` | only lines reachable from the production ref: what actually shipped |
| **Em progresso** | `progress` | integration + branch lines: work not released yet — the current minor's branch, features under construction |

Typical management questions: "how much unreleased work is piling up?" → **Em progresso**, together with the [Branches page](../dashboard/branches.md); "what did the team really ship in the last 12 months?" → **Produção**.

## What follows the scope

Panels backed by commit lines count only the lines of the selected scope: the summary cards and their deltas, the commits timeline, the heatmaps, commit types, lines added/removed, the per-dev and per-repo counts, the weekly champions, fix hotspots, **Ritmo — últimas 4 semanas vs 8 anteriores** and **Fora do horário**. The dev and repo profile pages follow the scope in their filtered panels too.

Fixed *period* windows still apply the scope: **Ritmo** and **Fora do horário** in **8 semanas** mode ignore the period filter, but they count only the lines of the selected scope.

On the dev profile (`/devs/<name>`), the historical cards — **dias ativos**, **commits/dia ativo**, **streak** and **repositórios** — read the axis of the selected scope when the data carries the per-author `byScope` axes (collections since issue #152): with **Produção**/**Em progresso** and the axis present, the `(total)` suffix no longer comes from the scope cut (it still marks the period cut). A row without the axes degrades to the lifetime counters with `(total)` — feature-detect on the presence of `byScope`.

## What ignores the scope (and why)

- **PRs, cycle time, reviews** (`/prs`): GitHub process data carries no git-ref classification — a PR is an event, not a commit line.
- **Releases**: milestones.
- **Inatividade — repos e devs parados**: measured up to today over the full history, on purpose. If it followed the **Produção** scope, a dev who spent the whole month on the minor's integration branch would show up as inactive while doing exactly what was asked of them.
- **Ranking do time (histórico completo)**: a lifetime counter — the `/devs` table reads the integral `perAuthor` row. Streaks and active days are lifetime counters everywhere except the dev-profile historical cards above, which read the `byScope` axis when the data carries one.
- **Weekly summary**: the whole-team meeting report, which ignores every sidebar filter.
- **Commit graph** (`/repos/<name>#grafo`): a fixed window of the last N commits — removing commits would break the merge chains.
- The **/branches** page: the progress view by nature — the scope chips stay hidden there.

## Known limitations

- **Squash double counting**: when a PR lands through a squash-merge, the branch's original commits never become reachable from production — they stay **Em progresso** forever, while the squashed commit counts in **Produção**. The same work appears in both scopes and **Todos** sums the two. The double count only leaves the totals when the branch is deleted on the remote and a later full collection purges the unreachable commits — which can decrease historical totals retroactively with no new fact behind it (the collector log is the only trace).
- **Ref hints are best-effort**: each commit records the first reachable ref as a hint; a long-lived branch can swallow the attribution.
- **Remote-only commits carry no ref hint on a normal checkout**: a commit reachable only through remote-tracking refs (no matching local head — a single-branch clone, a CI worktree) gets no hint. Expected: same class as "reachable only by tag"; the scope classification stays correct, only the best-effort hint is missing. Managed bare clones (the product default) are unaffected — every remote ref lands as a local `refs/heads/*`. The hint walk deliberately keeps remote-tracking refs off the positive side: measured on a full checkout (local heads + remote-tracking), adding them rewrote hints already assigned (`x` became `origin/x`) on every collection.
- **Data from before the split**: collections made before the prod/progress classification carry no scope data — the dashboard forces the filter to **Todos** on them. Lines that could not be classified (for example an unresolvable production ref) stay out of the scoped buckets and totals, with a warning at collection time.

## Where to read more

- [Filter rules](../dashboard/filters.md): period, URL parameters, per-route behavior and the fixed windows.
- [Metrics glossary](../dashboard/metrics.md): the formula behind every number.
- [Branches page](../dashboard/branches.md) and [Commit graph](../dashboard/graph.md).
- [Collectors](../architecture/collectors.md): how the scope classification runs at every collection.
