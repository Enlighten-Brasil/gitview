---
title: Development setup
description: Requirements, every package.json command, PR gates, conventions, and the Windows pitfalls.
---

# Development setup

gitview is read-only over the analyzed repos: the collectors read `git log`, tags and the GitHub API, and write JSON to `public/data/`. PRs proposing to write to the analyzed repos are not accepted.

## Requirements and first run

- **Node 22.13+** (the collectors use `node:sqlite`, flag-free since 22.13; the CI runs Node 22)
- **pnpm 11.28** (pinned in the `packageManager` field; `corepack enable` once resolves it)
- **A GitHub account** (token in the `.env` or `gh auth login`)

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev        # http://localhost:5173; with no data, lands on the /setup wizard
```

The `.env` is created from `.env.example` on the first run, and the team roster lives in `team.local.json`; both are gitignored. To work without the real org, point `GITVIEW_REPOS_ROOT` at your own clones: a token with access to a small public org is enough.

`pnpm-workspace.yaml` pins `minimumReleaseAge: 1440` and only installs packages published at least 24h ago. An `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` on a recent bump is expected: wait for the version to mature or list it in `minimumReleaseAgeExclude`.

## Commands

All the scripts in `package.json`:

| Command | What it does |
|---|---|
| `pnpm setup` | terminal wizard: choose and clone the org's repos |
| `pnpm collect` | the 6 collectors in sequence, plus `check:data` (incremental) |
| `pnpm collect:branches` | the branch inventory only (`branches.json`) |
| `pnpm collect:full` | the same chain with `--full` (full rescan + refetch) |
| `pnpm collect:github` | PRs and reviews only |
| `pnpm collect:graph` | the commit-graph topology only (`graph-*.json`) |
| `pnpm collect:reaggregate` | light: re-aggregation + PRs + team + `check:data` |
| `pnpm collect:releases` | releases only |
| `pnpm collect:team` | the team roster only (`team.json`) |
| `pnpm check:data` | shape and invariants of the JSONs; local data gate |
| `pnpm check:scrub` | tracked files free of identity terms; CI gate |
| `pnpm check:docs` | EN and pt-BR page parity; CI gate |
| `pnpm clean` | deletes the database and JSONs; `-- --repos` includes the clones |
| `pnpm dev` / `pnpm start` | dashboard at `http://localhost:5173` |
| `pnpm build` | static build in `dist/`; CI gate |
| `pnpm preview` | serves the locally built `dist/` |
| `pnpm lint` | ESLint `@antfu/eslint-config`; CI gate |
| `pnpm lint:fix` | lint with auto-fix |
| `pnpm typecheck` | `tsc --noEmit` over `scripts/`, `src/` and `test/`; CI gate |
| `pnpm test` | Vitest suite in `test/`; CI gate |
| `pnpm test:coverage` | the same suite with coverage (v8); enforces the per-scope floor of #251 and is what CI runs |
| `pnpm test:watch` | the same suite in watch mode, for the local loop |
| `pnpm docs:dev` | docs site in dev (VitePress, `DOCS_BASE=/`) |
| `pnpm docs:build` | docs site build; CI gate against dead links |
| `pnpm docs:preview` | serves the built docs site |
| `pnpm demo` | generates the synthetic fixture of the public demo (ten JSONs: eight fixed + two demo graphs, with fictional devs/repos) |
| `pnpm demo:shots` | regenerates the doc screenshots from the synthetic fixture |
| `pnpm snapshot:metrics` | regression harness for the aggregations: deterministic JSON of a matrix of filter scenarios (below) |
| `pnpm changeset` | record a change; required in PRs |
| `pnpm version:packages` | apply changesets (bump + `CHANGELOG.md`) |

## Gates before the PR

There is a Vitest suite (`test/`, node environment). Before opening a PR, run `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, plus `pnpm check:docs` when you touched `docs/` or `docs/.vitepress/config.ts`. Run `pnpm check:data` when you touched collectors or data shapes.

The CI (`.github/workflows/ci.yml`) runs scrub, lint, typecheck and build in the `gates` job, the suite in the `test` job, and `check:docs` plus `docs:build` in the `docs` job, on every PR and on push to `main`. `check:data` stays on your machine: `public/data/` is gitignored and only exists after a local collection with a token.

## Mandatory conventions

- **Every code change comes with a changeset**: `pnpm changeset` (`minor` = feature, `patch` = fix). A code PR without a changeset comes back in review.
- **Commits in pt-BR**, Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `chore(release): ...`); code in English, comments in pt-BR. A commit that closes a roadmap issue ends its body with `Ref: #N`.
- **Formatting is imposed by the lint**: `@antfu/eslint-config`, no semicolons, single quotes. Don't fight it: `pnpm lint:fix`.
- **Feedback copy**: an action with an effect emits a toast (`useToast`) with a short title in initial caps and an explicit `color`. Destructive confirmation always goes through `useConfirm()` (UModal): `title` is the question, `description` is the consequence, `confirmLabel` is the action. `window.confirm` and ad-hoc modals are forbidden.
- **A feature that writes config or data through the UI is born behind `import.meta.env.DEV`** and degrades in the static build: the page keeps rendering the JSONs, just without the editing controls.
- **Deleting files**: `rm -- <path>` (recoverable launcher), never `Remove-Item`.

## What lives where in `src/`

- `data.ts`: global filters, filtered aggregations (monthly, weekly, heatmap, types), totals, delta, pace, off-hours.
- `github.ts`: filtered PRs, aging, cycle time, reviews per dev, merge without review.
- `branches.ts`: `branches.json` loader + branch↔PR join, derived statuses (viva-sem-PR, pousada via squash) and the /branches cards and table.
- `graphData.ts` + `graph/`: the commit graph (`#grafo` of `/repos/:name`) — per-repo `graph-REPO.json` loader, pure lane algorithm (`graph/lanes.ts`), lane/ref colors (`graph/palette.ts`) and the tolerant refs reader (`graph/refs.ts`).
- `releases.ts`: `releases.json` loader and cadence metrics.
- `urlState.ts`: filters in the query string (`?range=&from=&to=&repos=&devs=&bots=`), scoped by `route.meta.filters`.
- `report-commits.ts`: pure shape/order validator and reconciliation core for the lazy `report-commits.json` artifact; no fetch, browser API or UI loader.
- `report.ts` + `daily.ts`: report engine (`buildReport(subject, from, to)`, preset windows, delta, weekly-summary fallback) and the optional day-precise `daily.json` loader (issue #176); `summary.ts` is now the closed-week × organization wrapper of the engine.
- `router/`: `guards.ts` applies the `route.meta` contract (`requiresData`, `onboarding`, `requiresServer`, `setupStep`, `section`, `filters`, `title`).
- `pages/`: one route per file: shell `(app)/`, tabs `(dashboard)/`, `devs/[name]`, `repos/`, `prs`, `teams`, `settings/` and `setup/` (dev only), `[...path].vue` for 404.
- `components/`: one component per panel; tables use the `.data-table` class.

The full pipeline and the filter rules are in the root `AGENTS.md`. Read it before touching collectors or metrics: several filter behaviors look strange and are intentional.

## Windows

- PowerShell 5.1: use `pnpm.cmd`, because the `pnpm.ps1` shim is blocked by the Execution Policy.
- Never edit a UTF-8 file via PowerShell (`Set-Content`, redirection): it produces mojibake.
- Never pipe a file-mutating CLI through `2>&1 | Select-Object`: it can abort the command mid-run.

## Validating the UI change

1. Run `pnpm dev` and exercise the path at `http://localhost:5173`.
2. Check what actually renders (DOM texts, tables, values) and the browser console.
3. Reka UI tabs don't respond to synthetic `.click()`: use a real click or navigate by URL (`/devs`, `/health`).
4. Finish with the gates above, including `pnpm check:data` if you touched the collectors.

## Regression harness for the aggregations (`snapshot:metrics`)

The Vitest suite does not reach this core (it needs the collected data); for changes to the filter/aggregation core (`filters-core.ts`, `filters.ts`, `aggregations.ts`) the house validation method is `scripts/snapshot-metrics.ts`: a pure node/tsx script (no vite, no browser) that injects the real `public/data/stats.json` into the store ref, mutates the filters only through the named actions and prints a deterministic JSON snapshot of everything derived from them, for a matrix of scenarios.

```bash
pnpm snapshot:metrics > baseline.json              # stdout = the baseline JSON
pnpm snapshot:metrics --now=2026-10-01 > b.json    # pinned clock (see below)
```

- **Scenarios** — 6 bases × 3 work scopes (`all`/`prod`/`progress`) = 18 snapshots: `default-12m`, `range-all`, `custom-range` (window derived from the data), `bots-on`, `single-repo` and `single-dev` (repo/dev names read from the `stats.json`, nothing hardcoded). Each snapshot carries `filteredTotals`, `filteredCommitCount`, `previousTotals`, the `pace`, `burnout` and `offHoursPeriod` rows, and the row counts + additive sums of the 4 filtered projections (`filteredWeekly`/`Monthly`/`Heatmap`/`Types`).
- **Determinism**: the output has sorted keys and no timestamp — the same `stats.json` + the same clock give byte-identical output. The period presets and the fixed week windows derive from "today": back-to-back runs are identical, but for a baseline kept across days use `--now=YYYY-MM-DD` (pins the global `Date` to local noon). Compare baselines generated on the same machine/timezone.
- **Comparing versions**: generate the baseline on `main`, switch to the branch, generate it again with the SAME `stats.json` and byte-compare (`cmp` / `sha256sum`). Every number that moves is a behavior change the diff must explain.
- **Built-in sanity**: the script verifies the additive identity `prod + progress == all` across every scenario (on stderr) and exits 1 on any violation.
- **Privacy**: over real data the output contains real author and repo names — never commit a baseline generated from team data. For a shareable baseline, generate the synthetic fixture (`pnpm exec tsx scripts/make-demo-data.ts`) and run against it.

After review, the path to a release is in [Release ritual](./release.md); the destination of `dist/` is in [Publishing the static build](../guide/publishing.md).
