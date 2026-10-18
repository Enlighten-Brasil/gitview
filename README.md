# gitview

[![CI](https://github.com/Enlighten-Brasil/gitview/actions/workflows/ci.yml/badge.svg)](https://github.com/Enlighten-Brasil/gitview/actions/workflows/ci.yml)

**Português (pt-BR):** [README.pt-BR.md](README.pt-BR.md)

**Simple git metrics for any team.** Commits, PRs and releases from your GitHub org, collected on your machine. gitview reads `git log`, tags and the GitHub API, generates JSON, and serves a dashboard that never writes to the analyzed repositories. MIT licensed.

**Live demo** (synthetic data only, no real team data): https://enlighten-brasil.github.io/gitview/

**Docs:** https://enlighten-brasil.github.io/gitview/docs/

![The gitview Visão geral page: summary cards, the alert strip and the commits-per-week chart (synthetic demo data)](docs/public/screenshots/overview.png)

## Run it now

Requirements: **Node 22.13+**, **pnpm 11.28** (pinned in the `packageManager` field; `corepack enable` once resolves it) and a GitHub account.

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev        # http://localhost:5173
```

Nothing to copy or edit first: `.env` is created from `.env.example` on the first run. With no collected data, the app opens the `/setup` wizard in four steps: connect to GitHub (device flow, pasted PAT or `gh auth login`), choose the repositories, clone and collect, and optionally map the team identities.

## What the dashboard shows

- **Visão geral** (`/`): commits, lines and pace for the period, with an alert strip that goes straight to the problem.
- **Devs** (`/devs`, `/devs/<name>`): ranking with commits, lines, active days and streak, day-and-hour heatmap, weekly champion by improvement, exportable CSV.
- **PRs** (`/prs`): aging of the open ones, cycle time, reviews per dev, merge without review.
- **Repos** (`/repos`, `/repos/<name>`): activity per repository and releases with the GitHub notes.
- **Times** (`/teams`, `/teams/<name>`): group devs by team and open the team dashboard, with period and repos filterable.
- **Saúde** (`/health`): off-hours work, fix hotspots, review bottleneck, inactivity and bus factor.
- **Resumo semanal**: markdown of the last closed ISO week against the previous one, ready to paste into the meeting.

## Collect and publish

- `pnpm collect` runs the collectors and the data validation; collection is incremental.
- `pnpm build` generates a 100% static `dist/` that any host serves, as long as there is an SPA fallback for the deep links.
- In the static build the dashboard is read-only: setup, collection and team editing only exist in `pnpm dev`. Adjust teams in dev, re-collect, and publish.

Full publishing flow, including the demo deploy: [Publishing the static build](docs/publishing/static-deploy.md).

## Commands

```bash
pnpm dev / start        # dashboard at http://localhost:5173
pnpm setup              # terminal wizard: choose and clone the org's repos
pnpm collect            # the 4 collectors in sequence + validation (incremental)
pnpm collect:github     # PRs and reviews only
pnpm collect:releases   # releases only
pnpm collect:team       # the team roster only
pnpm check:data         # validates shape and invariants of the collected JSONs
pnpm check:scrub        # identity gate for tracked files (also in CI)
pnpm lint / lint:fix    # ESLint @antfu/eslint-config
pnpm typecheck          # tsc --noEmit (scripts + src)
pnpm build              # static build in dist/
pnpm preview            # serves the local dist/
pnpm clean              # deletes database + JSONs; -- --repos also deletes the clones
pnpm docs:dev           # docs site in docs/ (VitePress)
pnpm changeset          # record a change
pnpm version:packages   # apply changesets (bump + CHANGELOG)
```

## Data on your machine

The `.env` holds the machine config (token, org, clones folder) and `team.local.json` holds the team roster (profiles, aliases, teams). Both are gitignored and created by you; `GITVIEW_GITHUB_TOKEN` is the project's only secret. Database, clones and JSONs are regenerable from the repositories.

Full reference: [The .env file](docs/configuration/env.md) and [Team config](docs/configuration/team.md).

For a token physically incapable of writing, use a **GitHub App** with *Repository Contents: Read-only* and put its Client ID in the `.env`. The device flow does not use a client secret.

## Contributing

Branch from `main`, gates before the PR (`pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build`), a changeset for every change, and a pt-BR commit in Conventional format. The flow is in [CONTRIBUTING.md](CONTRIBUTING.md) and detailed in [Development setup](docs/contributing/development.md) and [Release ritual](docs/contributing/release.md). The roadmap lives in the GitHub issues and milestones.

License: MIT.
