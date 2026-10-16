# Contributing to gitview

gitview is **read-only** over data: neither the collectors nor the UI write to the analyzed repositories — they read `git log`/tags and the GitHub API and generate JSON in `public/data/` (local, gitignored). PRs proposing to write to repos outside that line will not be accepted.

## Dev environment

```bash
pnpm install
pnpm dev        # http://localhost:5173 — first run lands on the /setup wizard
```

Requirements: **Node 22.13+** (the collectors use `node:sqlite`, flag-free since 22.13; the CI runs Node 22) and **pnpm 11.28** (pinned in the `packageManager` field — run `corepack enable` once so corepack picks it up, or install pnpm 11.28 directly). The `.env` is created automatically from `.env.example` on first run; the team roster lives in `team.local.json` (gitignored). To run it without a real org, point `GITVIEW_REPOS_ROOT` at your own clones (section "Pointing at existing clones" of the README) — a token with access to a small public org is enough.

The repo pins pnpm's supply-chain policy `minimumReleaseAge: 1440` in `pnpm-workspace.yaml`: only packages published at least 24h ago install. A fresh dependency bump that trips `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` is expected — wait for the version to mature or list it under `minimumReleaseAgeExclude`.

## Gates before opening a PR

There is no test suite; these are the checks:

```bash
pnpm lint       # eslint (@antfu/eslint-config) — zero errors is required
pnpm typecheck  # tsc --noEmit (scripts + src; .vue templates are out of scope)
pnpm build      # vite build — the compilation check
pnpm check:data # shape + invariants of the collected JSONs (runs at the end of pnpm collect)
```

The CI (`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm typecheck` and `pnpm build` on every PR and on pushes to `main`. `check:data` stays out of the CI on purpose: it validates `public/data/`, which only exists after a local collection.

## Style

- Code in English; comments and commit messages in **pt-BR**, Conventional Commits format (`feat(...)`, `fix(...)`, `docs(...)`, `chore(release): ...`).
  - Why pt-BR: the team that builds and maintains gitview works in pt-BR and the commit history is that team's working log; code and public docs stay in English so the open-source community can use the project.
- Formatting is enforced by `pnpm lint` — `eslint.config.js` applies `@antfu/eslint-config` (the maintainer's standard; **no semicolons**, **single quotes**) with the same vue exceptions as that standard (`no-mutating-props` and `prefer-separate-static-class` off — draft editors intentionally mutate parent objects).
- Edit UTF-8 files with a real editor — on Windows/PowerShell, never `Set-Content`/redirection (mojibake).

## Changesets — mandatory for every change

Every code change ships with a changeset:

```bash
pnpm changeset   # minor = feature · patch = fix
```

The release is applied by the maintainer: `pnpm version:packages` bumps the version, writes the `CHANGELOG.md` and results in a single `chore(release): X.Y.Z` commit. Work commits that close roadmap issues end their body with `Ref: #N`. A PR with code changes and no changeset comes back in review.

## dev-only vs static build (important)

The write endpoints (`/__setup/*`, `/__collect`, `/__clean`, `/__team/config`, `/__team/github`) are **dev-server middleware** — they do not exist in `pnpm build`. Consequences:

- `/setup` (wizard), `/settings` and the re-collect button (↻) only work under `pnpm dev`.
- `/teams` and `/repos` always render (the data comes from the JSONs), but only **edit** in dev — in the static build they are read-only.

If your feature needs to write config/data through the UI, it is born behind `import.meta.env.DEV` and **must degrade gracefully in the static build**: the page keeps rendering the data, just without the editing controls. A new feature that does not respect this will not land.

## The doc pairs (README + CONTRIBUTING)

`README.md` (English) is the primary document and `README.pt-BR.md` is a section-by-section mirror — this file and `CONTRIBUTING.pt-BR.md` follow the same rule. Any documentation change updates both files of the pair in the same change, and any command or label you cite must exist in `package.json`/the components.

## Reporting bugs

Open a GitHub issue with what you did, what you expected and what happened — collector output and `check:data` warnings make bugs much faster to pin down. Remember the tool is read-only over analyzed repos and never writes to them.

## Architecture

The `AGENTS.md` at the root documents the pipeline (git → SQLite → `public/data/*.json`), the `route.meta`/guards contract and the filter rules — read it before touching collectors or metrics; several "weird" filter behaviors are intentional and labeled in the UI.
