---
title: Metrics glossary
description: "Formula, window and threshold for every dashboard metric: commits, lines, PRs, reviews and releases."
---

# Metrics glossary

Every number on the dashboard has a formula, a window and a reading. The per-route filter scope and the list of fixed windows are in [Filter rules](./filters.md); the data origin in [Pipeline](../architecture/pipeline.md). If docs and code disagree, the code wins.

## Summary table

| Metric | What it measures | Window |
|---|---|---|
| Commits | non-merge commits ([Activity](#activity)) | period filter |
| Lines added / removed | numstat lines, generated excluded | period filter |
| Commits/active day | pace per day with commits | full history |
| Active days | distinct days with ≥1 commit | full history |
| Streak | consecutive days with commits | full history |
| Hour heatmap | commits by weekday × hour | period (max 24 months) |
| Commit types | conventional-commit mix | period filter |
| Pace | 4 weeks vs the 8 before | fixed |
| PR aging | days since the PR opened | now |
| Cycle time | median creation → merge | period; trend fixed |
| Reviews per dev | third-party reviews | period filter |
| Review concentration | top reviewer share | period filter |
| Merge without review | % of merges with no third-party review | period filter |
| Open PRs | PRs open at the last collection | now |
| Days since last release | days since the newest tag | milestones |
| Release cadence | tags per month | fixed: 12 months |
| Commits per release | commits between two tags | milestones |
| Unreleased commits | commits after the newest tag | now |
| Off-hours | weekend and late-night share | fixed: 8 weeks, or period |
| Inactivity | days since the last commit | up to today, no filters |
| Fix hotspots | % of `fix` commits per repo | period filter |
| Bus factor | top author share | period filter |
| Review bottleneck | top reviewer share | period filter |
| Weekly Champions | growth against own baseline | ISO week in the period |
| Card delta | % against the previous window | omitted in custom range and **Tudo** |

- A **fixed**, **now**, **milestones** or **full history** window: ignores the period on purpose and says so in the label, but respects repos, devs and bots. Only inactivity ignores the entire sidebar; releases follow the repo selection.
- Dates are stored in UTC ISO with milliseconds, and the time buckets (month, day, ISO week, weekend, late night, heatmap) come from `GITVIEW_TIMEZONE`, default `America/Sao_Paulo` ([Configuration](../configuration/env.md)).

## Activity

**Commits**: one row of `git log --all --no-renames --no-merges --numstat` per repo, inside the window. Merges are out of every metric, removed by topology and not by subject: a single-parent commit with a "Merge" subject (squash or rewritten pull) counts, and the output of a merge already shows up in the PR. `pnpm clean && pnpm collect` applies the filter to history already in the database. Commits with an unreadable date drop out of all buckets.

**Lines added and removed**: sums of `--numstat` per commit. Lockfiles and generated files are filtered line by line in the parse, never via pathspec: the commit counts, its generated lines do not. `GITVIEW_EXCLUDE_PATHS` (CSV of globs) adds your own patterns, with `/` matching the whole path and without `/` matching only the file name. The default list is in [Collectors](../architecture/collectors.md).

**Active days**: count of distinct calendar days with at least one commit. **Commits/active day**: `commits / max(diasAtivos, 1)`. Both are lifetime totals and appear with the `(total)` suffix on dev pages. On `/devs/<name>` with the work scope cut (`?scope=prod`/`progress`) and data carrying the per-author `byScope` axes (collections since issue #152), both read the axis of the selected scope and the `(total)` suffix marks only the period; without the axes the lifetime behavior stands (feature-detect on the presence of `byScope`).

**Streak**: pure calendar arithmetic over day keys in the canonical timezone, no local `Date` math, so DST and machine timezone cannot break the run. **streak** is the consecutive days ending on the last active day (a dev idle for 3 days still shows the run that ended there); **record** is the longest run ever, shown as `máx`. Since issue #152 the collector runs the same arithmetic per scope axis: with the scope cut and `byScope` present, the `/devs/<name>` card shows the run and the record of the axis.

**Hour heatmap** (**Frequência — dia da semana × hora**): commits per (author, repo, month, weekday, hour), with `0 = dom … 6 = sáb` and hour `0–23`. The aggregation keeps at most 24 months, so **Tudo** has that cap, and the period cuts by month.

**Commit types**: the conventional prefix of the subject (`type(scope)!: description`). Matches of `^([a-z]+)(\([^)]*\))?!?:` (case-insensitive) among `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`, `build` and `ci` keep their name; the rest becomes `outros`. The charts group into `feat`, `fix`, `refactor`, `chore`, `outros`, so the remaining categories disappear into `outros`; fix hotspots counts raw `fix`. Aggregation is monthly per (month, repo, author, type).

## Pace

**Ritmo — últimas 4 semanas vs 8 anteriores** ("Pace — last 4 weeks vs previous 8"): `ratio = (commits in the last 4 ISO weeks / 4) / (commits in the 8 previous ISO weeks / 8)`, `null` when the previous average is 0. The weeks are calendar weeks anchored on today: a week with no data counts 0 and the window never stretches. The list includes devs with a previous average `≥ 2` or recent commits `> 0`. **abaixo do ritmo** (below pace) at `ratio ≤ 0.5`; **acelerando** (accelerating) at `ratio ≥ 1.5`.

## Pull requests

From the GitHub collection: every open PR plus the ones merged in the last 400 days. GitHub login becomes the canonical dev name before any filter.

**PR aging**: `days since createdAt` in whole days up to now, with 0 shown as "hoje" (today). **PRs abertos — mais antigos primeiro** ("Open PRs — oldest first") paints age amber above 3 days and red above 7. **PRs parados — abertos há 14+ dias** ("Stale PRs — open for {n}+ days") lists the 5 oldest with age `≥ 14` (`mostrando N de M`; the full list is on the **PRs abertos — mais antigos primeiro** ("Open PRs — oldest first") panel) and the badge turns error with 5 or more stale PRs.

**Cycle time**: `cycleHours = (mergedAt - createdAt) / 3_600_000`. The **cycle time mediano** card names its cut: **cycle time mediano (corte por dia)** ("median cycle time (day cutoff)") (`/prs` and the team page) is the median over PRs merged within the exact day window of the filter, while **cycle time mediano (PRs do mês)** (dev and repo detail) covers whole months touched by the window — the same period therefore shows different numbers per page. An even count uses the mean of the two central values, and with no PRs the result is 0. Per repo (**Cycle time mediano por repo (criação → merge, corte por dia)**, day cut), only repos with 3 or more merged PRs in the window qualify. The **Tendência de cycle time** panel uses the last 6 months: one median per month, months with no PRs skipped, `subindo` (rising) when the last 3 months with data are strictly increasing, and repos with fewer than 3 PRs in the window stay out.

**Reviews per dev and concentration per repo**: counts the reviews of PRs merged in the period, no self-review and no bots. **Reviews por dev** ("Reviews per dev") splits into total, `APPROVED` and `CHANGES_REQUESTED`. **Concentração por repo** is `top reviewer reviews / third-party reviews in the period`, sorted by that value.

**Merge without review**: a PR with no third-party non-bot review; `round(without review / merged in the period × 100)`. `≥ 10%` is attention and `≥ 20%` is critical, in the summary cards and the alert strip.

## Releases

From the release collection: local `git tag` for coverage and the GitHub REST API for names and notes. Tags are milestones, so the panels ignore the period and follow the repo selection. Commits are attributed to tags by timestamp comparison, never by text.

- **Days since last release**: days since the newest tag, `null` with no tags, warning at 30+ days.
- **Release cadence**: tags with a date in the last 12 months divided by 12, shown as `X/mês`.
- **Commits per release**: commits with a timestamp in `(previous tag, this tag]`; each tag row shows its own count.
- **Unreleased commits**: commits after the newest tag; badge `N não liberados` from 20, red from 50.

## Off-hours

`weekend` (Sat and Sun) and `night` (22h–6h) commits in the canonical timezone: `offHoursPct = (weekend + night) / total`. A row appears only with `total > 0` and at least one off-hours commit.

- **8 weeks mode**: fixed window. Shows `fds ativos (últ. 4)` (active weekends in the last 4): how many of the window's last 4 weekly rows carry a weekend commit, counted per author × repo × week (the same weekend in two repos counts twice).
- **Period mode**: follows the sidebar, ignores devs with fewer than 20 commits in the period and judges by percentage only.
- Status: **padrão** at `offHoursPct ≥ 25%` or `fds ativos (últ. 4) ≥ 3`; **atenção** at `≥ 15%`, raised to attention in 8 weeks mode when there are 5+ off-hours commits; **pontual** below.
- In the weekly summary, the dev is flagged at `≥ 25%` with at least 5 commits in the week.

## Health thresholds

Each card on the Saúde page documents its own values in the footer.

| Card | Metric | Attention | Critical |
|---|---|---|---|
| Pace | ratio vs the previous average | `≤ 0.5×` | `≤ 0.5×` becomes error in the panel |
| Stale PRs | age of an open PR | `≥ 14` days | error badge with `≥ 5` stale |
| PR age (table) | age of an open PR | `> 3` days | `> 7` days |
| Merge without review | % without third-party review | `≥ 10%` | `≥ 20%` |
| Inactivity (dev) | days since the last commit | `≥ 21` days | `≥ 60` days |
| Inactivity (repo) | days since the last commit | `≥ 30` days | `≥ 90` days |
| Fix hotspots | % of `fix` commits | `≥ 25%` | `≥ 35%` |
| Unreleased commits | commits since the last tag | `≥ 20` | `≥ 50` |
| Off-hours | weekend and late-night share | `≥ 15%` | `≥ 25%` or 3+ weekends |
| Releases | days since the last tag | `≥ 30` days | — |
| Bus factor | top author share | `≥ 50%` | see note below |
| Review bottleneck | top reviewer share | `≥ 50%` | `≥ 70%` |

- **Bus factor** is critical at `≥ 70%` with at most 2 active devs, or at `≥ 50%` when the same author also does `≥ 70%` of the repo's reviews (review blind spot, which requires at least 5 reviews on the repo).
- **Minimum sample**: fix hotspots ignores repos with fewer than 20 commits in the period; bus factor, fewer than 10 commits; review bottleneck, fewer than 5 reviews.
- **Inactivity** is the only metric measured up to today, with the sidebar ignored: all repos, all devs, bots off the list. Days are whole: `floor((now − last commit) / 86 400 000)`.
- **Acelerando** (`ratio ≥ 1.5`) is green and not a risk tier; the alert strip uses the same drop at `≤ 0.5×`. Each stale PR row turns error at `≥ 30` days.

## Weekly Champions

**Campeão da semana — maior evolução**, for each ISO week in the period: `ratio = commits / (mean of the 8 calendar weeks before it inside the period + 1)`, with candidates from 3 commits in the week. The highest `ratio` wins; ties break by more commits, then by name. An empty week counts 0 and does not stretch the window; weeks before the start of the period do not count; a week with no previous week inside the period stays out. **vitórias (período)** counts the titles per dev in the window.

## Card delta

The summary cards compare against the equivalent previous window: in a 6M preset, the 6 months immediately before the cutoff, with the same repo, dev and bot filters.

- `pct = round((current − previous) / previous × 100)`; an absolute change of up to 2% appears as flat. Omitted in a custom range, in **Tudo** and when the previous window sums to zero.
- Color: commits, devs and repos rising are green, falling are red; lines are neutral. Tooltip: `vs o mês anterior` in the 1M preset, `vs os N meses anteriores` in the others.
