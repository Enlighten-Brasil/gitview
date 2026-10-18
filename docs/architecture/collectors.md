---
title: Collectors
description: Reference of the five collectors — outputs, sources, incremental modes, filters and the check-data gate.
---

# Collectors

The `scripts/` collectors are the whole data pipeline of gitview: they read git remotes and the GitHub API and write the five JSONs in `public/data/`. This page is the reference — what each one writes, how the incremental modes work, and what never enters the metrics.

## Summary

| script | output | source |
|---|---|---|
| `collect.ts` | `stats.json` (aggregates) + `commits.json` (last 100 commits/author) | `git log --all --no-merges --numstat` → SQLite (`data/gitview.db`, incremental) |
| `collect-github.ts` | `github.json` (PRs + reviews, login→dev map) | GitHub GraphQL API (token in `.env` or `gh auth token`) |
| `collect-releases.ts` | `releases.json` (tags, commits per tag, unreleased, notes) | `git tag` + GitHub REST API |
| `collect-team.ts` | `team.json` (devs, teams, unmapped candidates) | `team.local.json` + `stats.json`/`github.json` already generated |
| `check-data.ts` | — (validation only, exit 1 on error) | the 5 JSONs in `public/data/` |

`pnpm collect` runs the four collectors in sequence and `check-data.ts` at the end. Every collector that walks repos processes them in parallel with a pool of 4. Identity mapping is explicit: GitHub logins and commit e-mails resolve to canonical names through `devProfiles` in `team.local.json` (merged in `scripts/lib/team.ts`), never by fuzzy matching.

## collect.ts modes

The git collector is incremental by default. Three knobs control how much git work happens:

- **Incremental (default)**: per repo, `git log` gets `--since=<watermark>`, where the watermark is `MAX(date)` of that repo's rows in the database minus a 7-day margin (commits with old committer dates merged after the watermark still land). Inserts use `INSERT OR IGNORE` on `(repo, hash)`, so the overlap is harmless and re-runs never duplicate.
- **`--full`**: ignores the watermark and rescans the complete history of every repo.
- **`--reaggregate`**: skips the managed-clone fetch and the `git log` entirely — nothing new enters the database. It only re-applies aliases to rows already stored (a renamed dev is fixed with `UPDATE ... WHERE email = ?`) and re-exports the JSONs.

Two things happen on every run regardless of mode: rows from repos that left the selection are pruned from the database (a repo that comes back gets a full scan, since its watermark is empty), and date columns written by old versions are migrated to the current UTC format (see below).

## The light re-collection

The **salvar + recoletar** button in `/teams` triggers `GET /__collect?light=1`, which runs:

1. `scripts/collect.ts --reaggregate` — re-applies the new aliases, no git scan;
2. `scripts/collect-github.ts` — incremental PR fetch;
3. `scripts/collect-team.ts` — rebuilds `team.json`;
4. `scripts/check-data.ts` — the gate.

No git scan and no releases in this path: team edits change identity mapping, not history. Adding/removing an alias still needs the light run to reach `stats.json` — that's why the button exists. (Removing an alias does not rename rows already stored in the database; only `pnpm clean` + `pnpm collect` rewrites those.)

## Managed clones: fetch and read-only

Clones created by the setup wizard live in `data/repos/` (bare, gitignored). At the start of `collect.ts`, each managed clone gets `git fetch --all --prune --tags`, with three safety measures:

- **Token never on disk**: the auth header is injected per process via `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0` (`http.https://github.com/.extraheader` = `AUTHORIZATION: basic <base64 of x-access-token:token>`) — nothing in the argv, nothing in the clone's config. `GIT_TERMINAL_PROMPT=0` keeps git from prompting.
- **`scrubPersistedToken`**: unsets any `extraheader` older versions persisted in the clone config (token at rest). Idempotent, re-run every collection.
- **`denyPush`**: sets `remote.origin.pushurl=no-push`, so `git push` fails even if the credential allows writes. Idempotent, applied at clone time and on every collection. gitview is read-only over the analyzed repos.

A failed fetch is tolerated: the collector warns and falls back to the local cache.

## Dates and timezones

Two rules keep dates comparable everywhere:

- **UTC ISO with milliseconds**: commit dates are stored as `2026-10-08T18:05:13.000Z`. The git `%aI` format emits the author's original offset, which broke lexicographic comparison and ordering when stored raw. An idempotent migration runs on every database open and normalizes old rows.
- **Canonical timezone**: every time bucket (month, day, ISO week, weekend, night, heatmap) is computed in `GITVIEW_TIMEZONE` (default `America/Sao_Paulo`) via `Intl.DateTimeFormat`, never in the collecting machine's clock. An invalid IANA name falls back to the default with a warning. Streaks use pure calendar arithmetic on day keys, so DST cannot break them.

:::info Why do the buckets use a fixed timezone?
The same database must produce byte-identical aggregates on any machine. Before [issue #8](https://github.com/Enlighten-Brasil/gitview/issues/8), the ISO week key used UTC while the other buckets used the machine's local timezone — the same commit could land in different weeks depending on where you collected. `GITVIEW_TIMEZONE` models the team's actual "night" and "weekend" (UTC models nobody's), and one timezone is the only way the heatmap, streaks and monthly charts agree with each other.
:::

Timestamps, not strings, decide order everywhere it matters: `collect-releases.ts` counts commits per release by comparing epochs, and `check-data.ts` verifies `commits.json` is in true descending order.

## What never enters the metrics

- **Generated-file lines**: lockfiles, minified bundles and generated sources never count toward line metrics — but their commits do. The filter runs **in the numstat parse** (per file line), with the glob list in `DEFAULT_EXCLUDE_PATHS` (`scripts/lib/config.ts` — `pnpm-lock.yaml`, `*.min.js`, `*.snap`, `*.generated.ts`, …) plus your own `GITVIEW_EXCLUDE_PATHS` (CSV of globs). Glob semantics: `*` matches within a path segment, `**` any depth; a pattern with `/` matches the full path at any depth, without `/` only the basename; case-sensitive like `.gitignore`. Because the exclusion happens at insert time, applying new patterns to old history needs `pnpm clean && pnpm collect`.

:::info Why filter in the numstat (and never with a pathspec)?
A `git log` pathspec excludes *commits*: a commit that only touches `pnpm-lock.yaml` would vanish entirely, distorting commit counts, releases and heatmaps. Filtering the numstat lines keeps the commit and drops only the generated lines from `additions`/`deletions` — which is what line metrics should mean.
:::

- **Merge commits**: removed in the `git log` call by topology (`--no-merges`), not by subject. Single-parent commits whose subject starts with "Merge" (squash or rewritten pull) still count. History stored before this rule keeps its merges — `pnpm clean && pnpm collect` applies it retroactively. The rationale lives in the [pipeline page](./pipeline.md) (issue #7).
- **Rows with broken dates**: a row the parser cannot date is skipped from every bucket, and the collector warns with a count.

## check-data.ts: the validation gate

`pnpm check:data` runs standalone and as the last step of `pnpm collect` and `/__collect`. It only reads `public/data/*` and fails the collection (exit 1) on any structural or invariant error.

**Structural asserts**: each file exists, parses to a top-level object, has a valid ISO `generatedAt`, and its lists carry the fields the frontend reads (checked on the first item).

**Invariants** (main ones):

- `stats.json`: Σ`perAuthor.commits` = Σ`perRepo.commits` = Σ`monthly.commits` = `totals.commits`; non-negative counts; `heatmap.weekday` 0–6 and `hour` 0–23; `monthly.month` in `YYYY-MM`; `authors[].bot` is boolean.
- `commits.json`: dates uniformly UTC (ending in `Z`), strictly non-increasing by timestamp, `hash` in 7-hex format.
- `github.json`: `state` is `OPEN` or `MERGED`; `MERGED` has a valid `mergedAt`; no `repo#number` duplicates; review `state` in the closed union `APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING` (issue #42); nothing `MERGED` older than the 400-day window — the gate allows 401 days, one day of slack over `generatedAt` so a PR collected right at the cutoff isn't flagged (issue #5).
- `releases.json`: tags in descending date order, non-negative commit counts, and `unreleased` + Σ commits in tags = the repo's commits in `stats.json`.
- `team.json`: unique dev names; every team member is a known dev; `candidates[].kind` is `author` or `login` and never a ghost or bot; no case-duplicate logins within a dev.

**Non-blocking warnings** (quality, printed but never fatal): a team member who is also an unmapped candidate, a human dev with no aliases, `lastCommit` in the future (author clock wrong — it breaks the incremental watermark), and merge-subject zero-diff commits in the `commits.json` sample.

## Commands

```bash
pnpm collect            # the 4 collectors in sequence + check-data at the end
pnpm collect:github     # PRs only
pnpm collect:releases   # releases only
pnpm collect:team       # team only
pnpm check:data         # validation only (shape + invariants)
pnpm clean              # wipe database + JSONs (everything regenerable; clones need a flag)
```

## Next steps

- [Pipeline](./pipeline.md) — the flow these collectors implement.
- [Data model](./data-model.md) — the exact shape check-data expects.
