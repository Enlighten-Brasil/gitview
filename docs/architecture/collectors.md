---
title: Collectors
description: What each collector in scripts/ reads, what it writes, and how to control the run modes.
---

# Collectors

The collectors in `scripts/` read the git repos and the GitHub API and write the six JSONs in `public/data/` plus one `graph-<repo>.json` per repo (commit topology for the graph view). `pnpm collect` runs the six in sequence and ends with `check-data.ts`; collectors that walk repos use a pool of 4. Identity mapping is explicit: logins and e-mails resolve to canonical names via `devProfiles` in `team.local.json` (`scripts/lib/team.ts`), never by fuzzy matching.

## Summary

| script | output | source |
|---|---|---|
| `collect.ts` | `stats.json` (aggregates, incl. the per-author `byScope` prod/progress axes) + `commits.json` (last 100/author) | `git log --all --no-renames --no-merges --numstat` → incremental SQLite |
| `collect-github.ts` | `github.json` (PRs + reviews, login→dev map) | GitHub GraphQL API (token in `.env` or `gh`) |
| `collect-branches.ts` | `branches.json` (branch inventory: closed-union status, ahead/behind without merges, raw author e-mails ahead, +/− lines) | `git for-each-ref` + `git log`/`rev-list` on the local clones |
| `collect-graph.ts` | `graph-<repo>.json` (commit topology WITH merges, one file per repo: 40-hex hash/parents, canonical author, UTC ISO ms date, subject, ref/tag decoration) | `git log --all --date-order` on the local clones (window `GITVIEW_GRAPH_WINDOW`, default 1000) |
| `collect-releases.ts` | `releases.json` (tags, commits per tag, unreleased, notes) | `git tag` + GitHub REST API |
| `collect-team.ts` | `team.json` (devs, teams, unmapped candidates) | `team.local.json` + `stats.json`/`github.json` |
| `check-data.ts` | — (validation only; exit 1 on error) | the JSONs in `public/data/` (the 6 fixed + the `graph-*.json` present) |

## Incremental collection

- **`collect.ts` (default)**: `git log` gets `--since=<watermark>` per repo: `MAX(date)` in the database minus 7 days, a margin that covers commits with an old committer date. `INSERT OR IGNORE` on `(repo, hash)` makes the overlap harmless.
- **`--full`**: rescans the whole history, ignoring the watermark.
- **`--reaggregate`**: skips the fetch and `git log`; re-applies aliases to stored rows and re-exports the JSONs. The `byScope` axes derive from the stored `scope` column, so this mode repopulates them without git.
- **`collect-github.ts`**: refetches only PRs updated since the last collection (1-day margin) and merges with the previous file; stored MERGED PRs are preserved, the fresh OPEN list is the truth, and PRs whose `mergedAt` fell outside the window expire. `--full` ignores the cache in the fetch, and the previous file remains as a safety net: a repo that fails does not show up empty on the dashboard.
- **`collect-branches.ts`**: no incremental mode — every run re-enumerates `refs/heads` in full (pool of 4 with async spawns; ~25s for ~200 branches on 14 repos). It never fetches: freshness is tied to the `collect.ts` fetch at the start of the chain, like `stats.json`.
- **`collect-graph.ts`**: no incremental mode — every run re-walks the last `GITVIEW_GRAPH_WINDOW` commits per repo (default 1000; pool of 4 with async spawns, ~1s for 14 repos) and rewrites its `graph-<repo>.json`. It never fetches and never touches the database or `stats.json`: freshness is tied to the `collect.ts` fetch at the start of the chain.

On every `collect.ts` run: repos outside the selection are pruned from the database (if they come back, the empty watermark forces a full scan) and dates outside the UTC format are normalized.

## Light re-collection

`GET /__collect?light=1` (the **salvar + recoletar** (save + re-collect) button in `/teams`) runs `collect.ts --reaggregate`, incremental `collect-github.ts`, `collect-team.ts` and `check-data.ts`. It skips the git scan, releases, branches and graph: team edits change identity, not history — and without a fetch, re-enumerating branches or re-walking the topology would return exactly what the last full collection produced, at a cost. Existing `graph-*.json` files survive the light re-collection untouched (nothing rewrites or deletes them); the gate validates the files present, and a repo of `stats.json` without its graph file is a warning, not an error — only a full collection generates it.

## Managed clones: fetch and read-only

The setup clones live in `data/repos/` (bare, gitignored). At the start of `collect.ts`, each gets `git fetch --all --prune --tags`, with three locks:

- **Token never on disk**: auth is injected only into the command's process via `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0` (`extraheader` Basic with `x-access-token:`), nothing in argv or in the clone's config; `GIT_TERMINAL_PROMPT=0` blocks credential prompts.
- **`scrubPersistedToken`**: removes `extraheader` values written to the clone config by past runs. Idempotent, runs on every collection.
- **`denyPush`**: writes `remote.origin.pushurl=no-push`; `git push` fails even with a write credential. Applied at clone time and on every collection.

A fetch failure is tolerated: the collector warns and uses the local cache.

## Dates and timezone

- **Storage**: UTC ISO with milliseconds (`2026-10-08T18:05:13.000Z`); lexicographic comparison and ordering depend on this format.
- **Aggregation**: every bucket (month, day, ISO week, weekend, night, heatmap) is computed in `GITVIEW_TIMEZONE` (default `America/Sao_Paulo`) via `Intl`, never on the machine's clock; an invalid IANA name falls back to the default with a warning. The same database produces byte-identical aggregates on any machine, and the buckets reflect the team's real night and weekend. Streaks use calendar arithmetic on day keys, immune to DST; since issue #152 the same arithmetic also runs per scope axis — `perAuthor[].byScope.{prod,progress}` carries the measured fields of the row recomputed over the axis's own rows (day and repo sets, sums, last commit).
- **Order**: timestamps decide, not strings: `collect-releases.ts` counts commits per release by comparing epochs, and the gate checks the real descending order of `commits.json`.

## What never enters the metrics

- **Generated-file lines**: lockfiles, minified and generated files do not count in line metrics; their commits do. The filter runs in the numstat parse, per line: a pathspec in `git log` would exclude whole commits from counts and heatmaps. List: `DEFAULT_EXCLUDE_PATHS` (`scripts/lib/config.ts`) plus `GITVIEW_EXCLUDE_PATHS` (CSV of globs). Semantics: `*` matches within a segment, `**` at any depth; a pattern with `/` matches the whole path, without `/` only the basename; case-sensitive like `.gitignore`.
- **Merge commits**: removed by topology (`--no-merges`), not by subject; the `+0-0` diff would inflate commits/day, pace and streaks, and the output is already counted in the PR. A single-parent commit with a "Merge" subject (squash or rewritten pull) counts. The ONE exception is `collect-graph.ts`: the topology file carries merges because they are the connectors of the graph drawing — it feeds neither the database nor the metrics, so the decision stands intact.
- **Rows with no parseable date**: dropped from every bucket; the collector warns with a count.

Insert rules do not reach rows already stored, and removed aliases do not revert names in the database: `pnpm clean && pnpm collect` rebuilds everything.

## check-data.ts: the gate

`pnpm check:data` runs standalone and as the last step of `pnpm collect` and `/__collect`. It only reads `public/data/`; a structure or invariant error takes the collection down with exit 1.

- **Structure**: every file exists, parses to a top-level object, has a valid ISO `generatedAt`, and the first item of each list carries the fields the frontend reads. Per-file invariants in [Data model](./data-model.md).
- **Non-blocking warnings** (printed, never fatal): a team member who is also an unmapped candidate; a human dev with no aliases; `lastCommit` in the future (wrong author clock, breaks the watermark); a merge with zero diff in the `commits.json` sample.

## Commands

```bash
pnpm collect            # the 6 collectors in sequence + check-data at the end
pnpm collect:github     # PRs only
pnpm collect:branches   # branches only
pnpm collect:graph      # commit topology only (graph-*.json, with merges)
pnpm collect:releases   # releases only
pnpm collect:team       # team only
pnpm check:data         # validation only (shape + invariants)
pnpm clean              # wipes database + JSONs (clones only with a flag)
```
