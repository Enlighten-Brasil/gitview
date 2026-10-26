---
title: Data model
description: The shapes of the eight JSONs in public/data/ and the invariants the check-data gate requires of each.
---

# Data model

The eight fixed JSONs live in `public/data/`. `report-commits.json` is collected and validated for the next reports phase but is not read by the frontend yet. The frontend also loads one `graph-<repo>.json` per repo (commit topology for the graph view — only the file of the repo being visited). The shape is a contract: when a field the UI reads disappears, `check-data.ts` fails the collection. The gate's general behavior is in [Collectors](./collectors.md); here are the keys and the checks of each file.

## Summary

| file | holds | written by |
|---|---|---|
| `stats.json` | aggregates: weekly/monthly/heatmap/monthlyTypes/perAuthor/perRepo/repoUrls/totals | `collect.ts` |
| `commits.json` | last 100 commits per author | `collect.ts` |
| `report-commits.json` | complete classified commit history for reports, with full hashes and canonical day | `collect.ts` |
| `daily.json` | day-precise aggregate: day × repo × author (+ scope), commits, lines, weekend/night flags | `collect.ts` |
| `github.json` | PRs (OPEN + MERGED from the 400-day window) with reviews | `collect-github.ts` |
| `releases.json` | tags, commits per tag, unreleased, notes | `collect-releases.ts` |
| `team.json` | devs, teams, unmapped candidates | `collect-team.ts` |
| `branches.json` | branch inventory per repo: status, ahead/behind without merges, authors ahead | `collect-branches.ts` |
| `graph-<repo>.json` | commit topology WITH merges (one file per repo, window of `GITVIEW_GRAPH_WINDOW` commits) | `collect-graph.ts` |

Rules common to all eight: top-level object with `generatedAt` (ISO timestamp of the run), commit dates in UTC ISO with milliseconds. Authors are already canonical (aliases applied at collection) in every file **except `branches.json`**, which carries raw git e-mails (`%ae`) by design — pure git fact; the frontend maps e-mail→dev via `team.json#devs[].emails`. Lists are sparse: zero rows do not exist (no `commits: 0` filler).

## stats.json

| key | shape | meaning |
|---|---|---|
| `repos` | `string[]` | names of the repos included in the collection |
| `repoUrls` | `{ [repo]: string }` | web URL per repo (GitHub remotes only) |
| `authors` | `[{ name, emails, bot }]` | canonical authors and the e-mails seen for each |
| `totals` | `{ commits, prodCommits, progressCommits, additions, deletions, activeDays, repos, authors }` | global rollup; `prodCommits` + `progressCommits` = `commits` |
| `perRepo` | `[{ repo, commits, prodCommits, progressCommits, additions, deletions, authors, lastCommit }]` | per repo, sorted by commits desc |
| `perAuthor` | `[{ author, commits, additions, deletions, repos, activeDays, lastCommit, streak, longestStreak, byScope? }]` | per dev, sorted by commits desc; `streak` counts consecutive active days ending at the last active day; `byScope` (issue #152) = `{ prod, progress }` axes with the same measured fields over only that axis's lines (prod axis = scope `'prod'`; progress = `'integration'` + `'branch'`) — absent in data collected before the feature (feature-detect in the frontend); when present, BOTH keys exist and the empty axis carries `lastCommit` `''`. Lines with scope `NULL` stay out of the axes (same convention as totals) |
| `weekly` | `[{ week, repo, author, scope?, commits, weekend, night }]` | ISO week `YYYY-Www`; `weekend`/`night` are subsets (night = 22:00–05:59 in the canonical timezone) |
| `monthly` | `[{ month, repo, author, scope?, commits, additions, deletions }]` | month key `YYYY-MM` |
| `heatmap` | `[{ author, repo, month, weekday, hour, scope?, commits }]` | `weekday` 0–6, `hour` 0–23; only the last 24 months |
| `monthlyTypes` | `[{ month, repo, author, scope?, type, commits }]` | conventional commit type (`feat`, `fix`, …) or `outros` |

**Ref scope** (issue #119): every commit carries a `scope` in the database — `'prod'` (reachable from the production ref), `'integration'` (reachable from an integration ref but not from prod) or `'branch'` (the rest). The JSON rows use the *omit-prod* encoding: the optional `scope` field only travels when the value is `'integration'` or `'branch'` — **absent means production**. The aggregation keys of `weekly`/`monthly`/`heatmap`/`monthlyTypes` include the scope, so the same author/repo/period may appear in up to two rows (one per scope); sums (Σ) are preserved and frontend projections that group-and-sum see no difference. `progressCommits` = integration + branch (work in progress); the three explicit values live only in the database. Rows whose scope is still `NULL` (classification never ran or failed for the repo) stay out of every bucket and the collector logs a warning — `--reaggregate` does not run git, so it cannot classify.

**The gate requires**: Σ`perAuthor.commits` = Σ`perRepo.commits` = Σ`monthly.commits` = `totals.commits` (core invariant); `totals.prodCommits` + `totals.progressCommits` = `totals.commits`; Σ`monthly.commits` over rows *without* `scope` = `totals.prodCommits` and over rows *with* `scope` = `totals.progressCommits` (the heatmap gets no sum invariant: the 24-month cutoff breaks Σ by design); `scope`, when present, inside the closed union `'integration' | 'branch'` (every list); `totals.additions`/`deletions` ≥ 0 and per-author counts ≥ 0; `heatmap.weekday` in 0–6 and `hour` in 0–23; `monthly.month` matches `YYYY-MM`; `authors[].bot` is boolean; `perRepo[].lastCommit` parses as a date; per-author `byScope`, when present, has keys exactly `prod` and `progress` (closed union), `prod.X + progress.X = row.X` for `commits`/`additions`/`deletions`, axis `activeDays`/`repos`/`longestStreak` ≤ the row's, axis `streak` ≤ the axis's `longestStreak` (NOT ≤ the row's `streak`: the row's run ends on the row's last active day, which may belong to the other axis — a dev whose latest commit is progress can show row `streak` 1 while the prod axis keeps a longer run that ended earlier), and axis `lastCommit` ≤ the row's (ISO string comparison). **Non-blocking warning**: a repo with `commits > 0` and `prodCommits = 0` (suspicious production-ref configuration).

## commits.json

| key | shape | meaning |
|---|---|---|
| `commits` | `[{ hash, repo, author, date, message, additions, deletions, scope? }]` | last 100 commits per author, newest first |

`hash` is the abbreviated 7-hex form; `message` is the commit subject, limited to 500 chars in the database. `scope` uses the same *omit-prod* encoding as stats.json (absent = production); the sample skips commits with unclassified scope (`NULL` in the database).

**The gate requires**: dates uniformly UTC (ending in `Z`) and parseable; strict descending order by real timestamp (the dev profile page assumes this); `hash` matches `^[0-9a-f]{7}$`; `scope`, when present, inside the closed union `'integration' | 'branch'`.

## report-commits.json

| key | shape | meaning |
|---|---|---|
| `generatedAt` | UTC ISO with milliseconds | exactly the same snapshot marker as `stats.json#generatedAt` |
| `commits` | `[{ hash, repo, author, date, day, message, additions, deletions, scope? }]` | complete classified history for the next reports phase |

This is one lazy artifact with no UI loader yet. It contains the full classified population behind `stats.json` and `daily.json`, including bots, with no 400-day window, 100-per-author cutoff or shards. Rows pass the same invalid-date and unclassified-scope (`NULL`) skips as the aggregates and reuse their canonical `day`; the existing watermark and legacy database rows are preserved, so this is not a new promise of equality with a fresh `git log`. Canonical author names and the stored commit subjects, limited to 500 characters, are published with the static build.

`hash` is the full 40-lowercase-hex SHA and `(repo, hash)` is unique. `date` is UTC ISO with milliseconds; `day` is a real `YYYY-MM-DD` date; `additions`/`deletions` are non-negative integers; `scope` uses *omit-prod* encoding and, when present, is inside the closed union `'integration' | 'branch'`. Rows are sorted by timestamp descending, then `repo` and `hash` ascending. The separate `commits.json` contract remains unchanged: 7-hex hashes and at most 100 commits per author.

**The gate requires** every row to satisfy that shape and ordering, then reconciles commits/additions/deletions bidirectionally for each `[day, repo, author, scope]` against `daily.json`. It also checks `stats.json` totals, prod/progress counts, per-author metrics and available `byScope` axes, and per-repo metrics, so compensated global sums cannot hide moved, missing or extra rows.

## daily.json

| key | shape | meaning |
|---|---|---|
| `daily` | `[{ day, repo, author, scope?, commits, additions, deletions, weekend, night }]` | one row per day × repo × author (× scope); full history, no cutoff |

`day` is the canonical-timezone date `YYYY-MM-DD` (`dayKeyOf` — never a UTC `slice`, which would shift day boundaries and diverge from `totals.activeDays`). `weekend`/`night` are the same subsets as `stats.json#weekly` (night = 22:00–05:59 in the canonical timezone), so off-hours stay day-precise in any rolling window. The file is lazy like `commits.json` (outside the initial load) and carries the whole history (~19 KB/year of rows; re-evaluate near 2 MB). It exists for the reports engine (issue #176), whose 7/30-day rolling windows must cut by day instead of approximating week/month (median error over 100%).

**The gate requires**: `day` matches `YYYY-MM-DD`; Σ`daily.commits` = `totals.commits`; Σ over rows without `scope` = `totals.prodCommits` and over rows with `scope` = `totals.progressCommits`; Σ`additions`/Σ`deletions` = the totals; Σ`weekend` = Σ`weekly.weekend` and Σ`night` = Σ`weekly.night` (same predicates over the same lines); `scope`, when present, inside the closed union `'integration' | 'branch'`. **Non-blocking warning**: number of distinct `day` values ≠ `totals.activeDays` (canonical timezone drifted at collection).

## github.json

| key | shape | meaning |
|---|---|---|
| `users` | `{ [login]: { name, bot } }` | every login seen (authors + reviewers) mapped to the canonical name |
| `prs` | `[{ repo, number, title, url, state, draft, author, createdAt, mergedAt, additions, deletions, changedFiles, headRef?, baseRef?, headRefOid?, reviews }]` | all OPEN PRs + MERGED within the 400-day window |

`state` is `OPEN` or `MERGED`; `mergedAt` is `null` on an open PR. `author` is the login mapped via `users` (a deleted account becomes `ghost`). `reviews` is `[{ author, state, submittedAt }]` with `state` in `APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING`.

`headRef`/`baseRef` are the head and base branch names of the PR and `headRefOid` is the head SHA at collection time — the PR↔branch link, with `headRef` kept on merged PRs even after the branch is deleted. All three are **optional**: the incremental merge keeps propagating rows from caches older than the fields, so historical PRs stay without them until a single full rebuild (`pnpm clean && pnpm collect`) backfills everything. Consumers must treat a missing ref as an unknown link (partial coverage), never as a missing PR.

```json
{
  "repo": "<repo>",
  "number": 5,
  "title": "feat: new export",
  "url": "https://github.com/<org>/<repo>/pull/5",
  "state": "MERGED",
  "draft": false,
  "author": "ana-dev",
  "createdAt": "2026-01-23T21:06:43Z",
  "mergedAt": "2026-02-01T12:00:00Z",
  "additions": 140,
  "deletions": 32,
  "changedFiles": 3,
  "headRef": "feat/new-export",
  "baseRef": "main",
  "headRefOid": "3f9a1c7e5b2d84061fa9c3e7b5d20481af6c9e3b",
  "reviews": [
    { "author": "bruno-dev", "state": "APPROVED", "submittedAt": "2026-01-24T10:00:00Z" }
  ]
}
```

**The gate requires**: `users` is an object of `{ name: string, bot: boolean }`; every `MERGED` has a valid `mergedAt`; no `repo#number` duplicates; review `state` inside the union; no `MERGED` older than the window (the gate tolerates 1 day of slack over `generatedAt` so a PR collected at the cutoff is not flagged). The gate does **not** require `headRef`/`baseRef`/`headRefOid`: rows preserved from caches older than the fields legitimately lack them.

## releases.json

| key | shape | meaning |
|---|---|---|
| `repos` | `[{ repo, url, unreleased, tags }]` | one entry per repo; tags from newest to oldest |

| tag key | shape | meaning |
|---|---|---|
| `tag` | string | tag name |
| `date` | string ISO | tag creation (UTC) |
| `commits` | number | commits between the previous tag and this one (first tag: since the beginning) |
| `name` | string \| null | release title on GitHub (`null` without a GitHub release) |
| `notes` | string \| null | release body, truncated at 3000 chars |
| `prerelease` | boolean | GitHub prerelease flag |
| `url` | string \| null | release URL on GitHub |

`unreleased` counts commits after the newest tag; the counts compare timestamps, never text.

**The gate requires**: tag dates parseable and in descending order; `commits` ≥ 0 per tag; `unreleased` finite and ≥ 0; coverage invariant `unreleased` + Σ `tags[].commits` = the repo's commits in `stats.json.perRepo`.

## team.json

| key | shape | meaning |
|---|---|---|
| `devs` | `[{ name, title, description, emails, githubLogins, teams, bot }]` | canonical devs; `title`/`description` come from the profile, `null` otherwise; `emails`/`githubLogins` are the effective aliases, logins with the API casing |
| `teams` | `[{ name, description, color, members, renamedFrom? }]` | teams from `team.local.json`; `renamedFrom` lists the old names of a renamed team |
| `candidates` | `[{ kind, id, emails?, prs? }]` | unmapped identities: `kind: "author"` (raw git name, with `emails`) or `kind: "login"` (GitHub login, with `prs` count) |

**The gate requires**: dev names unique; every team member is a known dev; `candidates[].kind` ∈ {`author`, `login`}, never `ghost` and never a bot login; no case-duplicate logins within a dev.

## branches.json

| key | shape | meaning |
|---|---|---|
| `repos` | `[{ repo, productionRef, integrationRefs, branches }]` | one entry per repo; `productionRef`/`integrationRefs` are the refs resolved by `scripts/lib/refs.ts` (`integrationRefs` only lists refs that exist in that repo) |

| branch key | shape | meaning |
|---|---|---|
| `name` | string | branch name (short name of the `refs/heads` ref) |
| `tip` | string | SHA of the tip commit (full 40-hex as enumerated from the clone) |
| `lastActivity` | string ISO | committer date of the tip, UTC |
| `aheadProd` / `behindProd` | number | commits ahead of / behind the production ref, **without merges** (issue #7 decision) |
| `aheadInt` / `behindInt` | number \| null | same vs the FIRST resolved integration ref (config order); `null` when the repo has no integration ref |
| `authorsAhead` | `string[]` | distinct **raw e-mails** (`%ae`) of the authors of the commits ahead of production |
| `additions` / `deletions` | number | raw numstat sums of the commits ahead of production |
| `status` | string | closed union: `production`, `integration`, `feature`, `bot`, `pousada` |

`pousada` = `aheadProd = 0`, `aheadInt` null or 0, and no activity for ≥ `GITVIEW_BRANCH_STALE_DAYS` days (default 30). `bot` matches the `dependabot/` or `renovate/` prefix (`BOT_BRANCH_RE`) or an exact name in `GITVIEW_BOT_BRANCHES`. Status precedence: production → integration → bot → pousada → feature. Links to PRs (branch alive without a PR, pousada merged via squash) are computed by the frontend joining `github.json` (`headRef`) — they are not part of the status.

```json
{
  "repo": "<repo>",
  "productionRef": "main",
  "integrationRefs": ["develop"],
  "branches": [
    {
      "name": "feat/new-export",
      "tip": "3f9a1c7e5b2d84061fa9c3e7b5d20481af6c9e3b",
      "lastActivity": "2026-01-23T21:06:42.000Z",
      "aheadProd": 4,
      "behindProd": 12,
      "aheadInt": 4,
      "behindInt": 0,
      "authorsAhead": ["ana-dev@example.com"],
      "additions": 140,
      "deletions": 32,
      "status": "feature"
    }
  ]
}
```

**The gate requires**: valid `generatedAt`; every `repo` present in `stats.json#repos`; exactly one branch with status `production` per repo, named the same as that entry's `productionRef`; branch names unique per repo; `tip` matching `^[0-9a-f]{7,40}$`; `aheadProd`/`behindProd`/`additions`/`deletions` integers ≥ 0; `aheadInt`/`behindInt` integers ≥ 0 or `null`; `status` inside the closed union; `authorsAhead` a list of strings containing `@`; `lastActivity` parseable as a date. **Non-blocking warnings**: `lastActivity` in the future (more than 1 day of slack); a repo without any integration ref.

## graph-\<repo\>.json

One file per repo (`graph-<repo>.json`, `<repo>` = the folder name of the clone, same name used in `stats.json#repos`): the commit topology for the graph view, WITH merges — they are the connectors of the drawing. The collector reads git directly (`git log --all --date-order`); it feeds neither the database nor `stats.json`, so the `--no-merges` decision of the metrics stays intact.

| key | shape | meaning |
|---|---|---|
| `generatedAt` | string ISO | timestamp of the run that wrote this file |
| `repo` | string | repo name (equal to the file name stem) |
| `window` | number | `GITVIEW_GRAPH_WINDOW` used in the run (default 1000) — a COUNT of commits, not days |
| `commits` | `[{ hash, parents, author, date, subject, refs }]` | the last `window` commits of all refs, descending by timestamp |

| commit key | shape | meaning |
|---|---|---|
| `hash` | string | full 40-hex SHA |
| `parents` | `string[]` | full 40-hex SHAs of the parents: `[]` at a root, 2+ at a merge. Parents outside the window are NOT resolved — the renderer indexes hash→row and clips them |
| `author` | string | canonical author (aliases applied at collection) |
| `date` | string ISO | author date in UTC with milliseconds (`2026-02-01T12:00:00.000Z`) |
| `subject` | string | commit subject (`%s`, single line) |
| `refs` | `string[]` | decoration items (`%D`), one per entry: `HEAD -> main`, `tag: v1.0.0`, `develop`…; `[]` with no refs. Managed clones are BARE with local refs (`refs/heads/*`, no `origin/` prefix): branches come as short names |

```json
{
  "generatedAt": "2026-02-01T12:34:56.000Z",
  "repo": "<repo>",
  "window": 1000,
  "commits": [
    {
      "hash": "3f9a1c7e5b2d84061fa9c3e7b5d20481af6c9e3b",
      "parents": ["9c8f6e2a1d4b70358fa9c3e7b5d20481af6c9e11", "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d"],
      "author": "ana-dev",
      "date": "2026-02-01T12:00:00.000Z",
      "subject": "Merge branch 'feat/new-export' into main",
      "refs": ["HEAD -> main"]
    },
    {
      "hash": "9c8f6e2a1d4b70358fa9c3e7b5d20481af6c9e11",
      "parents": ["7d6c5b4a39281706f5e4d3c2b1a0988776655443"],
      "author": "bruno-dev",
      "date": "2026-01-31T18:05:13.000Z",
      "subject": "feat: new export",
      "refs": []
    }
  ]
}
```

**The gate requires** (per file present): valid `generatedAt`; `repo` equal to the file name stem; `window` an integer > 0 and `commits` no longer than the window; every `hash` and `parents[]` matching `^[0-9a-f]{40}$`; `author` a non-empty string; `date` in UTC ISO with milliseconds; `subject`/`refs` present (`refs` a list of strings); descending order by real timestamp; no duplicate hash. **Non-blocking warnings**: a repo of `stats.json#repos` without its `graph-<repo>.json` (only a full collection generates it — the light re-collection leaves existing files untouched and the UI shows an empty state); a graph file whose repo is not in `stats.json#repos` (orphan — the repo left the selection; `pnpm clean` removes it).
