---
title: FAQ
description: "Short answers to common gitview questions: clones, token and privacy, Windows, teams, merges, publishing and what is regenerable."
---

# FAQ

Short answers to the questions that come up most. Each one links to where the details live.

## Do I need to clone the repos myself?

No. The setup clones the repositories you pick into `data/repos/` (bare managed clones) and refreshes them with `git fetch` on every collection. If you already keep clones somewhere, set `GITVIEW_REPOS_ROOT` to that folder — collectors look there first. In that mode the numbers reflect your local clones, so `git pull` the repos before collecting. See the [quick start](./guide/quickstart.md).

## Is the gh CLI required?

No — it is an optional bridge. Authentication happens in the UI (device flow or a pasted PAT). When `GITVIEW_GITHUB_TOKEN` is empty and `gh auth login` is active, collectors fall back to `gh auth token`. See the [environment reference](./configuration/env.md).

## Do my data go to any server?

No. Collection writes a local SQLite database (`data/gitview.db`) and JSONs under `public/data/`; the frontend only reads those JSONs in the browser. The only outbound calls go to GitHub — the API and git — during setup and collection. See the [pipeline](./architecture/pipeline.md).

## Is it safe? What about the token?

The device flow needs no client secret (never add one) and stores the token in `.env`, which is gitignored. For a real permission guarantee use a **GitHub App** with *Repository → Contents: Read-only* — the token it issues is physically incapable of writing. Managed clones also get denyPush (`remote.origin.pushurl=no-push`). See the [environment reference](./configuration/env.md).

## My numbers changed after cleaning and re-collecting. Why?

:::info Why do re-collections change old numbers?
Two usual causes. Identity aliases: without a mapping in `team.local.json`, every commit e-mail and GitHub login counts as its own author, and unifying them rewrites `stats.json`. And `GITVIEW_EXCLUDE_PATHS` (generated files) only applies to new commits. To rewrite the history, run `pnpm clean && pnpm collect` — the buttons **limpar e recoletar** (UI) do the same. Details in the [metrics reference](./dashboard/metrics.md).
:::

## Does it work on Windows?

Yes. On PowerShell 5.1 call `pnpm.cmd` — the `pnpm.ps1` shim is blocked by Execution Policy. In `.env`, write paths with forward slashes (`C:/dev/repos/api`), or single-quote values that contain spaces. See the [environment reference](./configuration/env.md).

## Can I use it with another org or team?

Yes. Set `GITVIEW_GITHUB_ORG` (and `GITVIEW_DEFAULT_REPOS` for the setup pre-selection) and keep your roster in `team.local.json` — dev profiles, aliases and teams, all editable in `/teams`. The project ships no machine or team data. See the README section [Using it with another team/org](https://github.com/Enlighten-Brasil/gitview#using-it-with-another-teamorg).

## Merges don't show up in the metrics — is that a bug?

:::info Why don't merges count?
By design (decision in [issue #7](https://github.com/Enlighten-Brasil/gitview/issues/7)): 17.6% of commits were `Merge …` with +0−0 and they inflated commits/day, pace and streak — the merged work is already counted in the PR. The filter is topological (`git log --no-merges`), not by subject. Old rows still contain merges until you run `pnpm clean && pnpm collect`.
:::

## Can I publish the dashboard?

Yes. `pnpm build` produces a 100% static `dist/` — serve it from any static host (GitHub Pages, Netlify, nginx…). It needs SPA fallback: deep links like `/devs/<name>` must serve `index.html`. The static build is read-only: no `/setup`, `/settings` or re-collect. See [Publishing the dashboard](https://github.com/Enlighten-Brasil/gitview#publishing-the-dashboard-static-build).

## What is regenerable and what is not?

The database (`data/gitview.db*`), the JSONs in `public/data/` and the managed clones are regenerable from the repositories — `pnpm clean` deletes the first two (`--repos` also the clones). `.env` and `team.local.json` are **not** regenerable: they are your machine config and team roster, and `pnpm clean` never touches them. See the [data model](./architecture/data-model.md).

## Next steps

- [Quick start](./guide/quickstart.md)
- [Architecture](./architecture/pipeline.md)
