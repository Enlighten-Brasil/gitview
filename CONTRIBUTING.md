# Contributing to gitview

gitview is read-only over the data: collectors and UI read `git log`, tags and the GitHub API, and write only to `public/data/` (local, gitignored). A PR proposing to write to the analyzed repos will not be accepted.

## Getting started

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev        # http://localhost:5173; with no data, lands on the /setup wizard
```

Requirements: **Node 22.13+** (`node:sqlite` flag-free since 22.13) and **pnpm 11.28** (pinned in the `packageManager` field; `corepack enable` once resolves it). The `.env` is created from `.env.example` on the first run and the team roster lives in `team.local.json`, both gitignored. Open a branch from `main` and send the PR against `main`.

## Gates before the PR

The test suite is Vitest (node environment, tests in `test/`):

```bash
pnpm check:scrub  # tracked files free of the removed identity terms
pnpm lint         # ESLint @antfu/eslint-config; zero errors is required
pnpm typecheck    # tsc --noEmit over scripts/, src/ and test/ (.vue templates out)
pnpm test         # vitest run; the suite must be green
pnpm build        # vite build; the compile check
pnpm check:docs   # EN and pt-BR parity of the docs/ pages
pnpm check:data   # shape and invariants of the collected JSONs (runs on your machine)
```

The CI runs `check:scrub`, `lint`, `typecheck` and `build` in the `gates` job, `test` in the `test` job, and `check:docs` plus `docs:build` in the `docs` job. `check:data` stays on your machine because `public/data/` is gitignored and only exists after a collection with a token.

## Tests

- Non-trivial new logic is born with a test in `test/<module>.test.ts`; `pnpm test` is a gate and has to be green in the PR.
- Tests are pure node: no `public/data/`, no `.env`, no network — inline fixtures only, so the suite runs in CI and on a fresh clone. Validation that needs the collected data stays in `scripts/snapshot-metrics.ts`.
- `pnpm test:watch` is the local loop. `pnpm test:coverage` runs the suite with coverage (provider v8) and enforces the per-scope floor of #251: 90% statements on the `src/` modules tested in #249 and 60% on the `scripts/lib/` libs tested in #250. It is what CI runs in the `test` job.

## Changeset and commit

- Every code change comes with a changeset: `pnpm changeset` (`minor` = feature, `patch` = fix).
- Commits in pt-BR, Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`); code in English; comments in pt-BR.
- The maintainer closes a release with `pnpm version:packages` and a single `chore(release): X.Y.Z` commit.
- Formatting is what the lint mandates: no semicolons, single quotes. `pnpm lint:fix` handles the rest.

## Docs

The site in `docs/` is VitePress, with a section-by-section pt-BR mirror in `docs/pt-BR/`. Both languages change in the same PR and `pnpm check:docs` enforces the pair. If a PR changes a UI label, a command, a `GITVIEW_*` key or a metric rule, every page that cites it changes too. The screenshots in `docs/public/screenshots/` come from the demo's synthetic fixture: regenerate them with `pnpm.cmd demo:shots`.

```bash
pnpm docs:dev       # dev site, served from the root (DOCS_BASE=/)
pnpm docs:build     # static build in docs/.vitepress/dist
pnpm docs:preview   # serves the generated site locally
```

In PowerShell 5.1 run everything as `pnpm.cmd <script>`: the `pnpm.ps1` shim is blocked by the Execution Policy.

## Where the detail lives

- [Development setup](docs/contributing/development.md): every command, the gates, the code conventions and the `src/` map.
- [Release ritual](docs/contributing/release.md): from the changeset to the `chore(release)`, what CI requires, and how to propose a change.
- [Publishing the static build](docs/guide/publishing.md): what `pnpm build` produces and what stays out of it.
- `AGENTS.md` at the root: pipeline, the `route.meta` contract and the filter rules. Several "strange" filter behaviors are intentional and labeled in the UI.

Writing config or data through the UI only exists in the dev server: the `/__*` endpoints are middleware and don't enter the build. A new feature that depends on this is born behind `import.meta.env.DEV` and degrades to read-only in the static build.

## Reporting a bug

Open an [issue](https://github.com/Enlighten-Brasil/gitview/issues) with what you did, what you expected and what happened. The collectors' output and the `pnpm check:data` warnings pin the bug down faster.
