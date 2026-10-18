---
layout: home
title: gitview
description: "Team metrics for engineering managers — commits, PRs and releases across your GitHub org, collected locally and read-only."
hero:
  name: gitview
  text: Team metrics for engineering managers
  tagline: Commits, PRs and releases across your GitHub org — collected on your machine, strictly read-only.
  image:
    src: /logo.svg
    alt: gitview logo
  actions:
    - theme: brand
      text: Getting started
      link: /guide/quickstart
    - theme: alt
      text: Live demo
      link: https://enlighten-brasil.github.io/gitview/
    - theme: alt
      text: GitHub
      link: https://github.com/Enlighten-Brasil/gitview
features:
  - title: Read-only, for real
    details: "gitview never writes to the repositories it analyzes. With a read-only GitHub App the issued token physically cannot write, and managed clones get their push URL locked (`remote.origin.pushurl=no-push`)."
  - title: Runs locally, data stays yours
    details: "Collectors write SQLite and JSON on your machine; `.env` and `team.local.json` are gitignored. The only network calls go to GitHub — the API and git — during setup and collection."
  - title: Management filters and metrics
    details: "Streak, pace, cycle time, off-hours and a weekly summary — filter by period, repository, developer, team and bots."
  - title: Teams and identities
    details: "Unify commit e-mails and GitHub logins into dev profiles; every team gets its own dashboard at `/teams/<name>`."
  - title: 100% static
    details: "`pnpm build` outputs a `dist/` you can serve from any static host — the live demo is exactly that build."
  - title: MIT open source
    details: "Licensed under MIT. What comes next lives in GitHub issues and milestones; how to help is in `CONTRIBUTING.md`."
---

## How it works

Three steps, no servers to configure in between:

1. **Connect GitHub** — device flow in the browser, a pasted PAT, or the `gh` CLI as a bridge. The first run lands on the `/setup` wizard; there is nothing to edit beforehand.
2. **Collect** — the collectors stream `git log` into SQLite and export JSON to `public/data/`; PRs and reviews come from the GitHub API, and releases combine local tags with the API. Re-collection is incremental (the ↻ in the navbar).
3. **Browse the dashboard** — commits, PRs, releases, streak, cycle time and off-hours, with filters for period, repositories, developers and teams.

The full pipeline (git → SQLite → `public/data/*.json` → static frontend) is documented in [Architecture](./architecture/pipeline.md).
