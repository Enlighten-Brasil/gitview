---
title: Introduction
description: What gitview is, what it is not, and how these docs are organized — a read-only team metrics dashboard for GitHub orgs.
---

# Introduction

gitview is a team metrics dashboard for development managers: it tracks commits, pull requests (PRs) and releases across your GitHub org's repositories. Everything runs locally and is strictly read-only over the repos it analyzes.

## What gitview is

Point the collectors at your repositories and gitview turns `git log`, the GitHub API and `git tag` into a dashboard: commits per dev and per repo, PR and review flow, releases with their notes, plus derived views like streaks and cycle time. The pipeline writes JSON to `public/data/` and the frontend reads it — details in [Architecture](../architecture/pipeline.md).

The project is MIT-licensed and ships no machine or team data. There is a public demo running on synthetic data only (no real team data): https://enlighten-brasil.github.io/gitview/

## Central features

- **Runs locally** — `pnpm dev` serves the dashboard at `http://localhost:5173`. Database, clones and JSONs live on your machine (gitignored).
- **Strictly read-only** — gitview never writes to the analyzed repositories. Its only writes are its own local files: `.env`, `team.local.json`, `data/` and `public/data/`.
- **100% static frontend** — `pnpm build` produces a static `dist/` you can serve from any static host. The browser only reads the JSONs in `public/data/`; nothing is recalculated from git in the browser.
- **MIT license** — use it, fork it, adapt it. [CONTRIBUTING.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CONTRIBUTING.md) explains how to send changes back.

## What gitview is not

- **It is not CI.** Nothing about your builds, tests or deployments goes through gitview — it reads git history and the GitHub API, nothing else.
- **It does not write to your repos.** No comments, no labels, no pushes. The managed clones even have their push URL locked (`remote.origin.pushurl=no-push`).
- **It does not replace management.** The dashboard shows trends so your 1:1s and planning conversations run on numbers instead of memory. Judgement is still yours.

## Project status

The full pipeline works end to end: the collectors stream `git log` into SQLite and export JSON to `public/data/`, PRs and reviews come from the GitHub API, releases combine local `git tag` data with the API, and the frontend is a 100% static build that deploys to any static host — the live demo above is exactly that build. CI runs the gates on every PR (`pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build`), and every release ships with a changeset and a single `chore(release)` commit (history in [CHANGELOG.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CHANGELOG.md)).

What comes next lives in the GitHub issues and milestones — see [ROADMAP.md](https://github.com/Enlighten-Brasil/gitview/blob/main/ROADMAP.md). How to help is in [CONTRIBUTING.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CONTRIBUTING.md).

## How this documentation is organized

- **Getting started** (`guide/`) — this section: install, configure, and understand where everything lands.
- **Reference** — the `.env` keys, the metric and filter rules, the data model ([configuration/env.md](../configuration/env.md), [dashboard/metrics.md](../dashboard/metrics.md), [architecture/data-model.md](../architecture/data-model.md)).
- **Architecture** — how the collectors and the static build fit together (`architecture/pipeline.md`).
- **In the repo** — the [README](https://github.com/Enlighten-Brasil/gitview) covers setup and commands; `AGENTS.md` holds the architecture map, filter rules and conventions.

## Next steps

- [Quickstart](../guide/quickstart.md) — install and reach the dashboard.
- [The setup wizard](../guide/setup-wizard.md) — what each `/setup` step does.
- [Connecting GitHub](../guide/connecting-github.md) — pick an authentication path.
