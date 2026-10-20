---
title: Filter rules
description: The behavior of period, work scope, repos, devs and bots on each route, and the fixed windows that ignore the period.
---

# Filter rules

Global state shared by every page: period, work scope, repos, devs and bots. Each route declares what the sidebar shows and what goes into the URL. Every window that ignores the period is labeled on screen.

## Period

| Control | Window |
|---|---|
| **1M** **3M** **6M** **12M** **24M** | N months back from today, default **12M** |
| **Tudo** | the entire collected history |
| **Personalizado** | **de** and **até** dates (`dateFrom`, `dateTo`, `YYYY-MM-DD`) |

- A custom range prevails over the preset: in the URL, `from` and `to` win, `range` is ignored and the presets show as deselected.
- The custom range cuts by whole month. Aggregation is monthly or weekly, so a `from` in the middle of the month includes the full month.
- Card deltas are omitted in a custom range and in **Tudo**: no equivalent comparison window exists.
- The last used preset persists in `localStorage` (`gitview:range`) and a URL with no period parameters falls back to it; empty state uses **12M**.

## Work scope (production vs progress)

Every commit line carries a collection-time classification: production (reachable from the production ref) or progress (integration and other branches). The scope filter — the **Todos** / **Produção** / **Em progresso** chips — picks which lines the commit-backed panels count:

| Chip | `?scope=` | Counts |
|---|---|---|
| **Todos** | (omitted) | every commit line — the default |
| **Produção** | `prod` | only lines reachable from the production ref: released work |
| **Em progresso** | `progress` | integration + branch lines: work not released yet |

- Like the period, the scope applies on every data route (`full`, `team`, `period`, `period-bots`); `none` routes do not load it, and `/branches` does not consume it (the page is by nature the progress view — the chips stay hidden there).
- The last choice persists in `localStorage` (`gitview:scope`) and a URL without `scope` falls back to it; an invalid value drops to **Todos**. Data collected before the prod/progress split forces **Todos** (feature-detect on `totals.prodCommits`).
- Panels backed by commit lines follow the scope — including the fixed-window **Ritmo** and **Fora do horário** in **8 semanas** mode, which ignore the period but apply the scope. PRs, cycle time, reviews, releases, inactivity, the full-history ranking, streaks, the weekly summary, the commit graph and `/branches` read data with no scope classification.
- What each scope means for management, and the known limitations (squash double counting, best-effort ref hints): [Production vs progress](../guide/scopes.md).

## URL parameters

The sidebar writes the filters into the query string, so links and bookmarks reproduce the exact view. Defaults are omitted: `range` only appears when it is not **12M**.

| Parameter | Meaning | Example |
|---|---|---|
| `range` | preset `1`, `3`, `6`, `12`, `24` or `all` | `?range=6` |
| `from`, `to` | custom range `YYYY-MM-DD`, beats `range` | `?from=2026-01-01&to=2026-06-30` |
| `repos` | selected repos, comma-separated | `?repos=api,web` |
| `devs` | selected devs, comma-separated | `?devs=Ana,Bruno` |
| `bots` | `1` shows bots | `?bots=1` |
| `scope` | work scope: `prod` or `progress` (default `all`, omitted) | `?scope=prod` |

- Writes use `replaceState`, so filtering does not pollute the browser history.
- Back and forward take the URL as truth: state resets to defaults and the URL is applied.
- Values that no longer exist in the data (a renamed repo) drop out of the selection when the data loads.

## Per-route scope

The scope decides what the sidebar shows and what the URL carries. Every filter that changes a page appears on that page: no invisible filters exist.

| Scope | Routes | URL carries | Sidebar shows |
|---|---|---|---|
| `full` | `/`, `/devs`, `/health`, `/prs`, `/branches`, `/repos` | period, scope, `repos`, `devs`, `bots` | **Período**, **Times**, **Repos**, **Devs** |
| `team` | `/teams/:name` | period, scope, `repos` | **Período**, **Repos** |
| `period` | `/devs/:name` | period, scope | **Período** |
| `period-bots` | `/repos/:name` | period, scope, `bots` | **Período** and **incluir bots** |
| `none` | `/teams`, `/setup`, `/settings`, 404 | nothing | nothing |

The **Repos** and **Devs** sections carry bulk actions (**selecionar todos**, **inverter seleção**, **limpar**) and a **limpar filtros** (clear filters) button when there is a selection.

## Team chips in the sidebar

The **Times** section (only in `full` scope, only with visible members) is a shortcut over the **Devs** list.

- One click selects or clears all the members of the team at once; the chip style shows all, partial or none.
- The team never goes into the URL: the selection materializes in the devs list, so the link carries `devs=Ana,Bruno,…` and reproduces the same people for someone without your team registry.
- Only members present in the visible authors list count; hidden bots stay out while **incluir bots** is off.

## `/teams/:name` locked to the members

- The page locks the dev selection to the team members, which come from the team registry. The sidebar hides **Devs** and bots, and the URL carries only period and `repos`.
- Leaving the page keeps the members as the visible selection on the dashboard.
- Renamed team: `/teams/<old-name>` resolves to the current name, so shared links stay alive.
- **ver como filtro livre** (view as a free filter) opens `/` with `?devs=<members>`: the same people, now editable.

## Navigation keeps the context

Following a link (a dev name, a repo row, an alert chip) applies the parameters present in the URL without resetting the rest and rewrites the query in the scope of the new route. The chosen period follows the navigation; back and forward use the URL as truth.

## Fixed windows that ignore the period

| Panel | Window | Where |
|---|---|---|
| **Ritmo — últimas 4 semanas vs 8 anteriores** | last 4 weeks vs the 8 before | `/devs` |
| **Fora do horário** in **8 semanas** mode | last 8 weeks; the period mode follows the sidebar | `/health`, `/teams/:name` |
| **Tendência de cycle time — últimos 6 meses** | last 6 months | `/prs` |
| **PRs abertos** | state as of now | `/prs`, `/devs/:name`, `/repos/:name` |
| **Ranking do time (histórico completo)** | full history | `/devs` |
| **Inatividade — repos e devs parados** | up to today, ignores all filters | `/health` |
| **Releases por repositório** | milestones; footer **marcos — ignoram o filtro de período** | `/repos` |
| **Commit graph** (`#grafo`) | the repo's last N commits (`window` in the JSON, labeled in the footer); also ignores bots and scope | `/repos/:name` |

Each fixed panel declares its own window in the title or the footer, because the question defines the window: pace is, by definition, 4 weeks against the 8 before. The fixed windows respect repos, devs and bots, and the commit-line ones (pace, off-hours in **8 semanas** mode) also respect the work scope; only releases and inactivity ignore the entire sidebar. The formulas are in [Metrics glossary](./metrics.md).

## What follows the period on `/devs/:name` and `/repos/:name`

Commits, lines and devs cards, charts, merged PRs, cycle time, reviews and commit lists stay scoped to the window; **Tudo** means full history. These stay out, each one labeled:

- **dias ativos (total)**, **commits/dia ativo (total)**, **streak (total)** and **repositórios (total)**: lifetime counters with the `(total)` suffix when a period is active.
- **PRs abertos**: current state. **Releases**: milestones.
- Under **Tudo**, the hours heatmap covers at most 24 months (**Horários de atividade — últimos 24 meses**), the aggregation limit.
- On these routes the sidebar shows only the period selector, plus **incluir bots** on `/repos/:name`, where the switch applies to the repo's commits, commit types and PRs.
