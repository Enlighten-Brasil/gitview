---
title: Filter rules
description: How period presets, custom ranges, team chips and URL filters behave — including the fixed windows that ignore the period.
---

# Filter rules

Filters are global state shared by every dashboard page: a period, a repo list, a dev list and a bots switch. This page is the rulebook — including the windows that deliberately ignore your period. The spec lives in `AGENTS.md` ("Regras dos filtros"); the code is `src/filters-core.ts` (state), `src/filters.ts` (actions) and `src/urlState.ts` (URL sync).

## Period: presets or a custom range

| Control | Window |
|---|---|
| **1M** **3M** **6M** **12M** **24M** | N months back from today (default: **12M**) |
| **Tudo** | the entire collected history |
| **Personalizado** | date inputs **de** / **até** (`dateFrom`/`dateTo`, `YYYY-MM-DD`) |

Rules that are easy to mistake for bugs:

- A custom range **prevails over the preset**. In the URL, `from`/`to` win and `range` is ignored; the preset buttons deselect while **Personalizado** is active.
- The custom range **cuts by whole month**. The aggregation is monthly/weekly (month keys like `2026-03`), so a `from` in the middle of a month includes that month in full.
- Card deltas (the small % vs the previous window on the Visão geral cards) are **omitted** in custom ranges and in **Tudo** — there is no equivalent comparison window to compare against.
- The last preset you used persists in `localStorage` (`gitview:range`); a URL with no period parameters falls back to it. Fresh state defaults to **12M**.

## What lives in the URL

The sidebar writes the filters to the query string, so links and bookmarks reproduce the exact view:

| Param | Meaning | Example |
|---|---|---|
| `range` | preset: `1`, `3`, `6`, `12`, `24` or `all` | `?range=6` |
| `from`, `to` | custom range, `YYYY-MM-DD` — wins over `range` | `?from=2026-01-01&to=2026-06-30` |
| `repos` | selected repos, comma-separated | `?repos=api,web` |
| `devs` | selected devs, comma-separated | `?devs=Ana,Bruno` |
| `bots` | `1` = show bots | `?bots=1` |

- Defaults are omitted to keep URLs clean (e.g. `range` only appears when it is not **12M**).
- Writes use `replaceState` — clicking filters does not pollute the browser history.
- Back/forward (`popstate`): the URL is the source of truth. State resets to defaults, then the URL is applied.
- Sanitizing: values that no longer exist in the data (e.g. a renamed repo) are dropped from the selection when data loads.

## Filter scope per route

Each route declares a scope in `route.meta.filters`. The scope decides what goes to the URL **and** what the sidebar shows — nothing is applied invisibly:

| Route | Scope | URL carries | Sidebar shows |
|---|---|---|---|
| `/`, `/devs`, `/health` | `full` | period, `repos`, `devs`, `bots` | **Período**, **Times**, **Repos**, **Devs** |
| `/prs` | `full` | period, `repos`, `devs`, `bots` | **Período**, **Times**, **Repos**, **Devs** |
| `/repos` | `full` | period, `repos`, `devs`, `bots` | **Período**, **Times**, **Repos**, **Devs** |
| `/teams/:name` | `team` | period, `repos` | **Período**, **Repos** |
| `/devs/:name` | `period` | period | **Período** |
| `/repos/:name` | `period-bots` | period, `bots` | **Período** + **incluir bots** |
| `/teams` (editor), `/setup`, `/settings`, 404 | `none` | — (urlState does not act) | — |

The **Repos** and **Devs** sections of the sidebar carry bulk actions (**selecionar todos**, **inverter seleção**, **limpar**) and a **limpar filtros** button when anything is selected.

:::info Why do /prs and /repos show the filters?
Since 0.33, `/prs` and `/repos` (index) use the `full` scope: filters visible in the sidebar **and** in the URL. Before that they were hidden but still applied — the classic "ghost filter" that made numbers disagree between pages. If a filter changes a page, that page shows it.
:::

## Team chips in the sidebar

The **Times** section (only in `full` scope, only when teams have visible members) is a shortcut over the **Devs** list:

- Clicking a team chip selects/deselects **all its members at once**. The chip shows its state by style: all selected, partially selected, or none.
- The team itself never reaches the URL — the selection **materializes in `filters.authors`**, so the URL carries `devs=Ana,Bruno,…`. A shared link reproduces the same people even for someone without your `team.json`.
- Only members that exist in the visible authors list count (bots hidden unless **incluir bots** is on).

## `/teams/:name` — locked to the members

- The page **locks `filters.authors` to the team members** (source of truth: `team.json`). The sidebar shows no **Devs** and no bots — the URL carries only period + `repos`, because `/teams/<name>` is already the shareable context.
- Leaving the page keeps the members as the *visible* selection on the dashboard. Same rule as everywhere: no invisible filters.
- Renamed teams redirect: `/teams/<old-name>` resolves to the current name (`teams[].renamedFrom`, written by the `/teams` editor), so shared links stay alive.
- **ver como filtro livre** opens `/` with `?devs=<members>` — the same people, editable.

## Navigation keeps your context

Following a link (a dev name, a repo row, an alert chip) applies the parameters present in the URL **without resetting the rest**, then rewrites the query for the new route's scope. The period you chose follows you across pages. Back/forward takes the URL as truth.

## Fixed windows that ignore the period

Some panels answer "right now" or "historically" questions. They intentionally ignore the period filter and say so in their own label:

| Displayed label | Window | Where |
|---|---|---|
| **Ritmo — últimas 4 semanas vs 8 anteriores** | last 4 weeks vs the 8 before | `/devs` (PaceAlert) |
| **Fora do horário** — **8 semanas** mode | last 8 weeks (the other button follows the period) | `/health`, `/teams/:name` (OffHoursPanel) |
| **Tendência de cycle time — últimos 6 meses** | last 6 months | `/prs` (CycleTrend) |
| **PRs abertos** / **PRs abertos — mais antigos primeiro** | open PRs as of now | `/prs`, `/devs/:name`, `/repos/:name` |
| **Ranking do time (histórico completo)** | entire history | `/devs` (DevTable) |
| **Inatividade — repos e devs parados** | measured until today — ignores every filter | `/health` (InactiveWatch) |
| **Releases por repositório** | milestones (footnote: **marcos — ignoram o filtro de período**) | `/repos` (RepoReleasesGrid) |

:::info Why do fixed windows that ignore the period exist?
Because the question and the window are the same thing. "Is the pace falling?" is defined as 4 weeks vs the 8 before — cutting it to `?range=1` would destroy the comparison and produce a meaningless number. Each fixed panel states its window in the title so you never have to guess which filter a number is on.
:::

## `/devs/:name` and `/repos/:name` — what follows the period

Since 0.27.0 these profile pages **respect the period filter**: commits/lines/devs cards, charts, merged PRs, cycle time, reviews and the commit lists are restricted to the window. **Tudo** means the full history.

Kept out of the period by decision (each one labeled):

- **dias ativos (total)**, **commits/dia ativo (total)**, **streak (total)**, **repositórios (total)** — lifetime counters, suffix ` (total)` when a period is active.
- **PRs abertos** — state as of now.
- **Releases** — milestones (see `/repos/:name`).

The hours heatmap under **Tudo** covers at most 24 months (**Horários de atividade — últimos 24 meses**) — that is the aggregation limit.

On these routes the sidebar shows **only the period selector** (plus **incluir bots** on `/repos/:name`, where the switch applies to the repo's commits, commit types and PRs).

## Next steps

- [Dashboard tour](./tour.md) — what each page answers and where each panel lives.
- `AGENTS.md` ("Regras dos filtros") — the spec this page follows, in the repository.
