---
title: Development setup
description: Clone, run and validate gitview locally — commands, gates, conventions and the Windows pitfalls worth knowing before your first PR.
---

# Development setup

gitview is strictly read-only over the repos it analyzes: collectors read `git log`/tags and the GitHub API, and generate JSON in `public/data/`. PRs proposing to write to the analyzed repos are not accepted. This page gets you from clone to a validated change.

## How do I get the project running?

Requirements (copied from the README — do not invent versions):

- **Node 22.13+** — the collectors use `node:sqlite`, flag-free since 22.13; the CI runs Node 22
- **pnpm 11.28** — pinned in the `packageManager` field: run `corepack enable` once, or install pnpm 11.28 directly

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev        # http://localhost:5173 — first run lands on the /setup wizard
```

Nothing to copy or edit: `.env` is created automatically from `.env.example` on first run, and the team roster lives in `team.local.json` (both gitignored). To work without a real org, point `GITVIEW_REPOS_ROOT` at your own clones — a token with access to a small public org is enough.

One supply-chain quirk: the repo pins `minimumReleaseAge: 1440` in `pnpm-workspace.yaml`, so only packages published at least 24h ago install. A fresh dependency bump that trips `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` is expected — wait for the version to mature or list it under `minimumReleaseAgeExclude`.

## Which commands exist?

Every script in `package.json#scripts`, verbatim:

| Command | Underlying script | What it does |
|---|---|---|
| `pnpm setup` | `tsx scripts/setup.ts` | terminal wizard: choose/clone the org's repos |
| `pnpm collect` | `tsx scripts/collect.ts && tsx scripts/collect-github.ts && tsx scripts/collect-releases.ts && tsx scripts/collect-team.ts && tsx scripts/check-data.ts` | the 4 collectors in sequence + validation (incremental) |
| `pnpm check:data` | `tsx scripts/check-data.ts` | shape validation of the generated JSONs |
| `pnpm check:scrub` | `tsx scripts/check-scrub.ts` | tracked files must stay free of scrubbed identity terms (also a CI gate) |
| `pnpm collect:github` | `tsx scripts/collect-github.ts` | PRs/reviews only |
| `pnpm collect:releases` | `tsx scripts/collect-releases.ts` | releases only |
| `pnpm collect:team` | `tsx scripts/collect-team.ts` | team roster only (`team.json`) |
| `pnpm clean` | `tsx scripts/clean.ts` | deletes database + JSONs (regenerable; `-- --repos` includes the clones) |
| `pnpm docs:dev` | `pnpm --filter gitview-docs dev` | docs site dev server (VitePress, in `docs/`) |
| `pnpm docs:build` | `pnpm --filter gitview-docs build` | builds the docs site (fails on dead links) |
| `pnpm docs:preview` | `pnpm --filter gitview-docs preview` | serves the built docs site locally |
| `pnpm dev` | `vite` | dashboard at `http://localhost:5173` |
| `pnpm start` | `vite` | alias of `dev` (setup/collection only exist on the dev server) |
| `pnpm build` | `vite build` | static build (`dist/` — read-only, no setup endpoints) |
| `pnpm lint` | `eslint .` | lint (zero errors required) |
| `pnpm lint:fix` | `eslint . --fix` | lint with auto-fix |
| `pnpm typecheck` | `tsc --noEmit` | type check (scripts + src) |
| `pnpm preview` | `vite preview` | serves the built `dist/` locally |
| `pnpm changeset` | `changeset` | record a change |
| `pnpm version:packages` | `changeset version` | apply changesets (bump + CHANGELOG) |

## Which gates do I run before a PR?

There is no test suite — these five checks are the gates, and each catches something different:

| Gate | What it catches |
|---|---|
| `pnpm lint` | eslint (`@antfu/eslint-config`, config in `eslint.config.js`): style and formatting — zero errors is the requirement |
| `pnpm typecheck` | `tsc --noEmit` over `scripts/` + `src/` — type errors (`.vue` templates are out of scope) |
| `pnpm build` | `vite build` — the compilation check; a broken import or template fails here |
| `pnpm check:data` | shape + invariants of the collected JSONs in `public/data/` (also runs at the end of `pnpm collect`) |
| `pnpm check:scrub` | regressions of the identity scrub — tracked files must stay free of the scrubbed employer identity terms ([issue #17](https://github.com/Enlighten-Brasil/gitview/issues/17)) |

The CI (`.github/workflows/ci.yml`) runs `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck` and `pnpm build` on every PR and on pushes to `main`. `check:data` stays out of the CI on purpose.

:::info Why doesn't the CI run check:data?
`check:data` validates `public/data/`, which is gitignored and only exists after a local collection with a token. The CI does not collect and must not need a secret — so the data gate belongs on your machine, right after `pnpm collect`.
:::

## What conventions are mandatory?

- **Every change ships with a changeset**: `pnpm changeset` (`minor` = feature, `patch` = fix). The maintainer applies it with `pnpm version:packages`, which bumps the version, writes `CHANGELOG.md` and results in a single `chore(release): X.Y.Z` commit. A PR with code changes and no changeset comes back in review.
- **Commits in pt-BR** (Conventional Commits: `feat(...)`, `fix(...)`, `docs(...)`, `chore(release): ...`), code in English, comments in pt-BR. Work commits that close roadmap issues end their body with `Ref: #N`.
- **Formatting** is enforced by `pnpm lint` — `@antfu/eslint-config`: no semicolons, single quotes. Don't fight it; run `pnpm lint:fix` instead.
- **Feedback copy** (unified pattern): every state-changing action emits a toast (`useToast`) — short title in initial caps ("Perfis salvos"), lowercase description, `color` always explicit. Destructive confirmations always go through `useConfirm()` (UModal): `title` = a direct question ("Descartar alterações?"), `description` = the concrete consequence, `confirmLabel` = the action ("descartar", "remover time"). `window.confirm` and ad-hoc modals are forbidden.
- **Deleting files**: `rm -- <path>` (recoverable launcher), never `Remove-Item`.

:::info Why are commit messages in pt-BR?
The team that builds and maintains gitview works in pt-BR, and the commit history is that team's working log. Code and public docs stay in English so the open-source community can use the project. Translated UI copy is deliberate too: the dashboard's interface is pt-BR.
:::

## What lives where in `src/`?

- `data.ts` — global filters (`filters`) and filtered aggregations (monthly/weekly/heatmap/types), totals + delta, pace, burnout, off-hours.
- `github.ts` — filtered PRs, aging, cycle time, reviews per dev, merge without review.
- `releases.ts` — `releases.json` loader + metrics (days since last release, cadence).
- `urlState.ts` — filters in the query string (`?range=&from=&to=&repos=&devs=&bots=`), scoped by `route.meta.filters`.
- `router/` — file-based routes + the global guard; `route.meta` is the contract (`requiresData`, `onboarding`, `requiresServer`, `setupStep`, `section`, `filters`, `title`).
- `pages/` — one file per route (`(app)/` shell, `(dashboard)/` tabs, `devs/[name]`, `repos/`, `prs`, `teams`, `settings/` dev-only, `setup/` dev-only, `[...path].vue` 404).
- `components/` — one component per panel; tables use the `.data-table` class.

## What bites on Windows?

- **PowerShell 5.1**: use `pnpm.cmd` — the `pnpm.ps1` shim is blocked by the Execution Policy.
- **Never edit UTF-8 files via PowerShell** (`Set-Content`, redirection) — it produces mojibake. Use a real editor.
- **Never pipe a file-mutating CLI through `2>&1 | Select-Object`** — it can abort the command mid-run.

## How do I validate the UI?

There is no test suite, so validation is the gates plus your eyes on the running app:

1. `pnpm dev` → `http://localhost:5173` and exercise the change in the browser.
2. Validate what actually renders — DOM texts, tables, values — and keep an eye on the browser console. What the page *says* it shows is the source of truth, not what a screenshot looks like.
3. Reka UI tabs don't respond to synthetic `.click()` — click for real, or navigate by URL (`/devs`, `/health`, …).
4. Finish with the gates: `pnpm lint`, `pnpm typecheck`, `pnpm build` (and `pnpm check:data` when you touched collectors or data shapes).

## Next steps

- [Release ritual](./release.md) — how your change lands after review.
- [Publishing the static build](../publishing/static-deploy.md) — what happens to `pnpm build` output in production.
- [CONTRIBUTING.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CONTRIBUTING.md) — the short contributing guide in the repo.
