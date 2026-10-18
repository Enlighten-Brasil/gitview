---
title: Frequently asked questions
description: Short answers on clones, token and privacy, Windows, aliases, merges and publishing the dashboard.
---

# Frequently asked questions

## Do I need to clone the repositories manually?

No. Setup clones the repos you pick into `data/repos/` (bare clones) and runs `git fetch` in them on every collection. With your own clones, point `GITVIEW_REPOS_ROOT` at the folder that holds them and run `git pull` before collecting: see [Repositories](./guide/repositories.md).

## Is the gh CLI required?

No, it is an optional bridge. Authenticate through the UI (device flow or a pasted PAT); with `GITVIEW_GITHUB_TOKEN` empty and `gh` logged in, collection falls back to `gh auth token`: see [Connecting GitHub](./guide/connecting-github.md).

## Does my data leave the machine?

No. Collection writes `data/gitview.db` and the JSONs in `public/data/`, and the browser only reads those files. The only outbound calls go to GitHub, during setup and collection.

## Does gitview write to my repositories? What about the token?

No: it reads `git log`, `git tag` and the GitHub API, and managed clones block push (`remote.origin.pushurl=no-push`). The token stays in `.env`, gitignored and out of the dev server's reach. For a read-only guarantee enforced by permission, use a GitHub App with *Contents: Read-only*: see [Connecting GitHub](./guide/connecting-github.md).

## I changed an alias and the numbers did not change. Why?

An alias only takes effect when the data is re-aggregated: use **salvar + recoletar** (save + re-collect) in `/teams`. Removing an alias does not rename what is already in the database, and that takes `pnpm clean && pnpm collect`: see [Data maintenance](./configuration/maintenance.md).

## Do merges count in the metrics?

No. `git log` runs with `--no-merges`, so merges stay out of commits, pace and streaks. History already written before that keeps its merges until `pnpm clean && pnpm collect`: see [Metrics glossary](./dashboard/metrics.md).

## Does it work on Windows?

Yes. On PowerShell 5.1 call `pnpm.cmd`, because the `pnpm.ps1` shim is blocked by the Execution Policy. In `.env` paths use forward slashes: `C:/dev/repos/api`.

## Can I publish the dashboard?

Yes. `pnpm build` produces a static `dist/` for any static host, with SPA fallback for deep links. In that build the dashboard is read-only, with no `/setup`, `/settings` or re-collection: see [Publishing the static build](./publishing/static-deploy.md).

## Next steps

- [Quick start](./guide/quickstart.md): from clone to dashboard.
- [Data maintenance](./configuration/maintenance.md): re-collection and cleanup.
