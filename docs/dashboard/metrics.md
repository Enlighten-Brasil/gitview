---
title: Metrics glossary
description: Exact formula and calculation window for every metric in the gitview dashboard — commits, PRs, releases, health thresholds and deltas.
---

# Metrics glossary

Every number on the dashboard has one formula and one window. This page states both, straight from the collectors and `src/`, so you can trust a card without reading the source. When documentation and code disagree, the code wins.

## Summary table

| Metric | What it measures | Window |
|---|---|---|
| Commits | non-merge commits (see [Activity](#activity)) | period filter |
| Lines added / removed | numstat lines, generated files excluded | period filter |
| Commits/active day | rhythm per day with commits | full history (`(total)`) |
| Active days | distinct days with ≥1 commit | full history (`(total)`) |
| Streak | consecutive commit days | full history (`(total)`) |
| Hour heatmap | commits by weekday × hour | period filter (max 24 months) |
| Commit types | conventional-commit mix per month/repo | period filter |
| Pace | last 4 weeks vs the 8 before | fixed: 4 vs 8 weeks |
| PR aging | days since `createdAt` of open PRs | "now" |
| Cycle time | median creation → merge | period filter (trend: fixed 6 months) |
| Reviews per dev | third-party reviews made | period filter |
| Review concentration | top reviewer share per repo | period filter |
| Merge without review | % of merges with no third-party review | period filter |
| Open PRs | PRs open at collection time | "now" |
| Days since last release | days since the newest tag | milestones (ignore the sidebar) |
| Release cadence | tags per month | fixed: last 12 months |
| Commits per release | commits between tags | milestones (ignore the sidebar) |
| Unreleased commits | commits since the newest tag | "now" |
| Off-hours | weekend + late-night share | fixed: 8 weeks, or period |
| Inactivity | days since last commit | up to today (ignores all filters) |
| Fix hotspots | % of `fix` commits per repo | period filter |
| Bus factor | top author share per repo | period filter |
| Review bottleneck | top reviewer share per repo | period filter |
| Weekly Champions | evolution vs own baseline | per ISO week in the period |
| Card delta | % change vs previous window | omitted in custom range and **Tudo** |

Two window kinds exist. **Period filter** follows the sidebar (presets 1/3/6/12/24M or **Tudo**, plus a custom range `dateFrom`/`dateTo` that cuts by whole month — the aggregations are monthly/weekly, see [Filters](./filters.md)). **Fixed windows** ignore the period filter on purpose and say so in the card footer; they still respect the repo, dev and bot filters. Two panels ignore the sidebar entirely instead: releases (tags are milestones of the repo) and inactivity (measured up to today). Timestamps are stored in UTC ISO with milliseconds; time buckets are computed in `GITVIEW_TIMEZONE` (default `America/Sao_Paulo`).

## Activity

### Commits

A commit is one row of `git log --all --no-renames --no-merges --numstat` per repo. **Merge commits are out of every metric**: they are removed in the `git log` call by topology (`--no-merges`), not by subject — a single-parent commit whose subject says "Merge" (squash or rewritten pull) still counts. Commits with an unreadable date are dropped from all buckets.

:::info Why don't merges count?
Merge commits carried `+0−0` diffs but a large share of the scanned history was `Merge …` commits, inflating commits/day, pace and streaks. The "production" of a merge already shows up in the PR. Because the rule lives in the collector, old history already in the database keeps its merges — run `pnpm clean && pnpm collect` to apply it retroactively. See [issue #7](https://github.com/Enlighten-Brasil/gitview/issues/7).
:::

### Lines added / removed

Additions and deletions come from the `--numstat` output, summed per commit. Lockfile and generated-file lines are filtered **while parsing the numstat** (never via pathspec — that would drop whole commits): the commit counts, its generated lines don't. The default list (`DEFAULT_EXCLUDE_PATHS`) covers lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`, `Cargo.lock`, `composer.lock`, `Gemfile.lock`, `poetry.lock`, `Pipfile.lock`, `pubspec.lock`, `Package.resolved`, `go.sum`) and generated assets (`*.min.js`, `*.min.css`, `*.min.map`, `*.snap`, `*.generated.ts`, `*.generated.js`, `*.designer.cs`). `GITVIEW_EXCLUDE_PATHS` (CSV of globs) appends your own patterns. A pattern with `/` matches the whole path at any depth; without `/` it matches the basename; matching is case-sensitive like gitignore.

### Commits/active day and active days

```ts
commitsPerActiveDay = commits / Math.max(activeDays, 1)
```

`activeDays` is the count of distinct calendar days with at least one commit. Both metrics are historical totals — on dev pages they carry the `(total)` suffix when a period filter is active, because they intentionally stay outside the period filter.

### Streak

Streaks use pure calendar arithmetic over day keys in the canonical timezone (no `Date` local math, no elapsed-time division — DST or machine timezone can't break a run):

- **streak** (`streak`): consecutive days ending at the dev's last active day. A dev whose last commit was 3 days ago still shows the run that ended there.
- **record** (`longestStreak`): longest consecutive run ever ("máx" in the ranking).

### Hour heatmap

The **Frequência — dia da semana × hora** heatmap aggregates `stats.heatmap` rows: commits per (author, repo, month, weekday, hour), with weekday `0 = dom … 6 = sáb` and hour `0–23`. The collector keeps at most the last 24 months of heatmap rows, so even **Tudo** shows at most 24 months here. The period filter applies at month granularity.

:::info Why is there a canonical timezone?
All time buckets — month, day, ISO week, weekend, late night, heatmap — are computed in `GITVIEW_TIMEZONE` (default `America/Sao_Paulo`) via `Intl`, never in the collecting machine's clock. The same database produces byte-identical aggregates on any machine, and UTC alone models nobody's "late night" in practice. Before [issue #8](https://github.com/Enlighten-Brasil/gitview/issues/8) the ISO week key used UTC while the other buckets used local time — the same commit could land in different weeks depending on where you collected.
:::

### Commit types

The type is the conventional-commit prefix of the subject: `type(scope)!: description`. Anything matching `^([a-z]+)(\([^)]*\))?!?:` (case-insensitive) with `type` in `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`, `build`, `ci` keeps its name; everything else becomes `outros`. The charts (**Tipos de commit por mês (feat × fix × ...)**, **Mix por repo (% — ordenado por fix)**) group into five categories — `feat`, `fix`, `refactor`, `chore`, `outros` — so `docs`/`test`/`perf`/`style`/`build`/`ci` are displayed inside `outros`. The fix-hotspot metric counts raw `fix` commits. Aggregation is monthly per (month, repo, author, type) in `stats.json#monthlyTypes`.

## Pace

**Ritmo — últimas 4 semanas vs 8 anteriores** compares the last 4 ISO weeks with the weekly average of the 8 before them:

```ts
recent  = commits in the last 4 ISO weeks
prevAvg = (commits in the previous 8 ISO weeks) / 8
ratio   = (recent / 4) / prevAvg   // null when prevAvg = 0
```

Windows are calendar weeks anchored on today (a week with no data counts 0 — the window never stretches). Only devs with `prevAvg ≥ 2` or `recent > 0` appear. The window is fixed: it ignores the period filter but respects repos, devs and bots. Alerts: **abaixo do ritmo** when `ratio ≤ 0.5`, **acelerando** when `ratio ≥ 1.5` (a green, positive list — not a risk tier).

## Pull requests

All PR data comes from `github.json` (GraphQL: every OPEN PR plus MERGED PRs of the last 400 days). PR authors are resolved from GitHub login to the canonical dev name before any filter.

### Aging (open PRs)

Age is `daysSince(createdAt)` — full days elapsed to now (0 shows as "hoje"). **PRs abertos — mais antigos primeiro** sorts oldest first; age is painted amber above 3 days and red above 7 days. **PRs parados — abertos há 14+ dias** lists the 5 oldest open PRs with `age ≥ 14` days (`mostrando N de M`; the full list is on the Pull requests tab); the badge turns error when 5 or more PRs are stale, and each listed row turns red at `age ≥ 30` days. Open PRs are a "now" metric: the period filter never applies to them.

### Cycle time

```ts
cycleHours = (mergedAt - createdAt) / 3_600_000
```

The **cycle time mediano** card is the median of `cycleHours` over PRs merged in the filtered period (even count → mean of the two central values; no PRs → 0). Per repo, only repos with 3 or more merged PRs in the period get a median. The trend chart (`mediana do cycle time (criação → merge) por mês, com (n PRs)`) uses a **fixed 6-month window** (ignores the period filter, respects repos/devs/bots): one median per month, months with no PRs skipped, and `subindo` (rising) means the last 3 months with data are strictly increasing. Repos with fewer than 3 PRs in the window are dropped.

### Reviews per dev and concentration per repo

Reviews counted are those on PRs merged in the filtered period, excluding self-review (the PR author's own) and bot reviews. **Reviews per dev** splits them into total, `APPROVED` and `CHANGES_REQUESTED`. **Concentration per repo** (`reviewShareByRepo`) computes `topShare = topReviewerCount / thirdPartyReviewsInThePeriod` and sorts by it.

### Merge without review

A PR counts as "merged without review" when no review comes from another non-bot person. The metric is `round(withoutReview / mergedInThePeriod * 100)` — the **Merge sem review — período filtrado** card. Thresholds: ≥10% is attention, ≥20% is high (same values in the summary cards and the alert strip).

## Releases

Release data comes from `releases.json` (local `git tag` for coverage, GitHub REST API for names and notes). Tags are milestones: the release panels ignore the sidebar entirely — the grid footer reads `marcos — ignoram o filtro de período`. Commits are attributed to tags by **timestamp comparison, never text** (mixed UTC offsets used to assign commits to the wrong tag when compared as strings).

- **Days since last release**: `daysSince(tags[0].date)` — tags are stored newest first; `null` when the repo has no tags. At 30+ days the label turns warning (release "atrasada").
- **Release cadence**: tags with date in the last 12 months ÷ 12, shown as `X/mês`.
- **Commits per release**: commits whose timestamp falls in `(previous tag, this tag]` (ascending timestamps, two-pointer). Each tag row shows its own count.
- **Unreleased commits** (`unreleased`): commits after the newest tag. The badge `N não liberados` appears at ≥20 (attention) and turns red at ≥50.

## Off-hours / burnout

**Fora do horário** counts `weekend` (Sat/Sun) and `night` (22h–6h) commits — both in the canonical timezone — and shows `offHoursPct = (weekend + night) / total`. The card has two modes:

- **8 semanas** — fixed 8-week window (ignores the period filter). Also shows `fds ativos (últ. 4)`: how many of the window's last 4 weekly rows carry a weekend commit — counted per author × repo × week, so the same weekend in two repos counts twice. Rows need `total > 0` and at least one weekend/night commit.
- **período** (labeled with the current range) — follows the sidebar filter. Devs with fewer than 20 commits in the period are ignored (`OFF_HOURS_MIN_COMMITS`); like the 8-week mode, a row only appears with at least one weekend/night commit.

Status tiers: **padrão** at `offHoursPct ≥ 25%` or `fds ativos (últ. 4) ≥ 3`; **atenção** at `≥ 15%` — in the 8-week mode, having 5 or more weekend/night commits raises the floor to attention even below 15%; **pontual** below. The period mode judges by percentage only. In the weekly summary, a dev is flagged at `≥ 25%` off-hours with at least 5 commits that week.

## Health thresholds

Every `/health` card documents its own thresholds in the footer. Most values come from `src/thresholds.ts` (centralized since issue #26); the bus-factor and review-bottleneck tiers are still written inline in their panels. The values:

| Card | Metric | Attention | Critical |
|---|---|---|---|
| Ritmo (`PaceAlert`, `AlertStrip`) | ratio vs previous average | falling `≤ 0.5×` (warning in the strip) | `≤ 0.5×` is the error list in the panel; `≥ 1.5×` shows **acelerando** in green — positive, not a risk tier |
| PRs parados (`PrStaleAlert`) | age of open PRs | `≥ 14` days | badge error at `≥ 5` stale PRs; row error at `≥ 30` days |
| Idade de PR (`PrOpenTable`) | age of open PR | `> 3` days | `> 7` days |
| Merge sem review (`ReviewCoverage`, `PrSummaryCards`) | % merged without review | `≥ 10%` | `≥ 20%` |
| Inatividade — dev (`InactiveWatch`) | days since last commit | `≥ 21` days | `≥ 60` days |
| Inatividade — repo (`InactiveWatch`) | days since last commit | `≥ 30` days | `≥ 90` days |
| Fix hotspots (`FixHotspots`, `RepoTable`) | % of `fix` commits | `≥ 25%` | `≥ 35%` |
| Commits não liberados (`RepoTable`, `RepoReleasesGrid`) | commits since last tag | `≥ 20` | `≥ 50` |
| Fora do horário (`OffHoursPanel`) | off-hours share | `≥ 15%` (or 5+ weekend/night commits in 8-week mode) | `≥ 25%` or 3+ active weekends |
| Releases (`RepoReleasesGrid`) | days since last tag | `≥ 30` days | — |
| Bus factor (`BusFactor`) | top author share | `≥ 50%` | `≥ 70%` with ≤2 active devs, or top author `≥ 50%` who also does `≥ 70%` of reviews |
| Gargalo de review (`ReviewBottleneck`) | top reviewer share | `≥ 50%` | `≥ 70%` |

Sample-size guards (small samples are noise): fix hotspots ignore repos with fewer than 20 commits in the period; bus factor ignores repos with fewer than 10 commits; review bottleneck ignores repos with fewer than 5 reviews. Bus factor's "blind spot" (the top author also dominates reviews) needs at least 5 reviews on the repo.

Inactivity is the one metric measured **up to today, ignoring every sidebar filter** (all repos, all devs, bots excluded from the dev list) — someone quiet for weeks should show up no matter what you filtered. `daysSince` is whole days: `floor((now − lastCommit) / 86 400 000)`.

## Weekly Champions

**Campeão da semana — maior evolução** rewards improvement, not volume. For each ISO week in the filtered period:

```ts
// candidates: devs with >= 3 commits in the week (MIN_WEEK_COMMITS)
// baseline: the 8 calendar ISO weeks before it, restricted to the period
ratio = commits / (baselineMean + 1)   // baselineMean = sum / weeksInWindow
```

The winner is the highest ratio; ties break by more commits, then name. The baseline uses **calendar** weeks — an empty week counts 0 instead of stretching the window — and only weeks inside the filtered period count (`semanas anteriores ao início do período não contam`); a week with no prior week in the period leaves the ranking. The **vitórias (período)** table counts titles per dev across the period.

:::info Why reward evolution?
Pure volume gave 82% of the weeks to the same dev and rewarded commit-splitting. The formula `commits ÷ (mean of the previous 8 weeks + 1)` prizes rhythm: the `+1` in the denominator gives 2× to someone starting from zero, so returning from vacation wins a week, not the whole board. The 3-commit floor kills noise from tiny averages. See [issue #10](https://github.com/Enlighten-Brasil/gitview/issues/10).
:::

## Card deltas

Summary cards (commits, `linhas +`, `linhas −`, `devs ativos`, `repos ativos`) show a delta versus the **equivalent previous window**: for a 6M preset, the 6 months immediately before the cutoff. The comparison window is built with the same repo/dev/bot filters as the current one.

- The delta is **omitted** in a custom range and in **Tudo** — no comparable window exists (`previousTotals` returns `null`) — and also when the previous window sums zero (nothing to divide by).
- `pct = round((current − previous) / previous * 100)`; absolute change up to 2% shows as flat (`DELTA_FLAT_PCT`).
- Color: commits/devs/repos rising is green, falling red; line counts are neutral.
- Tooltip: `vs o mês anterior` for a 1M preset, `vs os N meses anteriores` otherwise.

## Next steps

- [Pipeline](../architecture/pipeline.md) — where each metric's data comes from (collectors, JSONs, invariants).
- [Development](../contributing/development.md) — how to run the collectors and change thresholds safely.
