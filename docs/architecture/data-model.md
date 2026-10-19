---
title: Data model
description: The shapes of the five JSONs in public/data/ and the invariants the check-data gate requires of each.
---

# Data model

The frontend consumes exactly five JSONs in `public/data/`. The shape is a contract: when a field the UI reads disappears, `check-data.ts` fails the collection. The gate's general behavior is in [Collectors](./collectors.md); here are the keys and the checks of each file.

## Summary

| file | holds | written by |
|---|---|---|
| `stats.json` | aggregates: weekly/monthly/heatmap/monthlyTypes/perAuthor/perRepo/repoUrls/totals | `collect.ts` |
| `commits.json` | last 100 commits per author | `collect.ts` |
| `github.json` | PRs (OPEN + MERGED from the 400-day window) with reviews | `collect-github.ts` |
| `releases.json` | tags, commits per tag, unreleased, notes | `collect-releases.ts` |
| `team.json` | devs, teams, unmapped candidates | `collect-team.ts` |

Rules common to all five: top-level object with `generatedAt` (ISO timestamp of the run), authors already canonical (aliases applied at collection), commit dates in UTC ISO with milliseconds. Lists are sparse: zero rows do not exist (no `commits: 0` filler).

## stats.json

| key | shape | meaning |
|---|---|---|
| `repos` | `string[]` | names of the repos included in the collection |
| `repoUrls` | `{ [repo]: string }` | web URL per repo (GitHub remotes only) |
| `authors` | `[{ name, emails, bot }]` | canonical authors and the e-mails seen for each |
| `totals` | `{ commits, additions, deletions, activeDays, repos, authors }` | global rollup |
| `perRepo` | `[{ repo, commits, additions, deletions, authors, lastCommit }]` | per repo, sorted by commits desc |
| `perAuthor` | `[{ author, commits, additions, deletions, repos, activeDays, lastCommit, streak, longestStreak }]` | per dev, sorted by commits desc; `streak` counts consecutive active days ending at the last active day |
| `weekly` | `[{ week, repo, author, commits, weekend, night }]` | ISO week `YYYY-Www`; `weekend`/`night` are subsets (night = 22:00–05:59 in the canonical timezone) |
| `monthly` | `[{ month, repo, author, commits, additions, deletions }]` | month key `YYYY-MM` |
| `heatmap` | `[{ author, repo, month, weekday, hour, commits }]` | `weekday` 0–6, `hour` 0–23; only the last 24 months |
| `monthlyTypes` | `[{ month, repo, author, type, commits }]` | conventional commit type (`feat`, `fix`, …) or `outros` |

**The gate requires**: Σ`perAuthor.commits` = Σ`perRepo.commits` = Σ`monthly.commits` = `totals.commits` (core invariant); `totals.additions`/`deletions` ≥ 0 and per-author counts ≥ 0; `heatmap.weekday` in 0–6 and `hour` in 0–23; `monthly.month` matches `YYYY-MM`; `authors[].bot` is boolean; `perRepo[].lastCommit` parses as a date.

## commits.json

| key | shape | meaning |
|---|---|---|
| `commits` | `[{ hash, repo, author, date, message, additions, deletions }]` | last 100 commits per author, newest first |

`hash` is the abbreviated 7-hex form; `message` is the commit subject, limited to 500 chars in the database.

**The gate requires**: dates uniformly UTC (ending in `Z`) and parseable; strict descending order by real timestamp (the dev profile page assumes this); `hash` matches `^[0-9a-f]{7}$`.

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
