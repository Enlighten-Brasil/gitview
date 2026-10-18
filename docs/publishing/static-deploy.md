---
title: Publishing the static build
description: What pnpm build produces, what it drops, the SPA fallback every host needs, and how the public demo is deployed.
---

# Publishing the static build

`pnpm build` turns the dashboard into a 100% static `dist/` with no server of its own — the frontend only reads the JSONs in `public/data/`. This page covers what the build contains, what it deliberately leaves out, and how to serve it anywhere.

## What does `pnpm build` produce?

A `dist/` folder with static files only: no runtime server, no database, no git access. Everything the dashboard shows comes from the JSONs copied from `public/data/` (`stats.json`, `commits.json`, `github.json`, `releases.json`, `team.json`) — nothing is recalculated from git in the browser. Any static host can serve it.

## What does not exist in the static build?

The write endpoints (`/__setup/*`, `/__auth/*`, `/__collect`, `/__clean`, `/__team/config`, `/__team/github`) are **dev-server middleware** — `pnpm build` does not include them. In the static build the dashboard is strictly read-only:

| Feature | `pnpm dev` | static build |
|---|---|---|
| `/setup` (setup wizard) | works | doesn't exist — only works under `pnpm dev` |
| `/settings` | works | doesn't exist (`requiresServer` routes are dev-only) |
| Re-collect button (↻) | works | doesn't render (`import.meta.env.DEV` only) |
| `/teams` editor | works | disabled — `/teams` and `/repos` still render the data from the JSONs, without editing controls |
| `/__*` endpoints | dev-server middleware | don't exist |

Practical consequence: unify identities and tune teams in dev, re-collect, then publish. Config changes made in the UI never reach an already-published `dist/` — new data means a new build.

## Why do deep links need an SPA fallback?

The router uses `createWebHistory`: `/devs/<name>` is a real URL, not a hash. When someone opens that link directly (or refreshes the page), the server must answer with `index.html` — otherwise the host returns its own 404 and the dashboard never boots.

The minimum configuration per host:

- **GitHub Pages** has no rewrite rules — the trick is to copy the entry file: `cp dist/index.html dist/404.html`. Pages serves `404.html` for unknown paths, and the router takes over from there.
- **Netlify** (generic host reference — check your host's own docs): publish `dist/` and add a `_redirects` file:

```text
/*  /index.html  200
```

- **nginx** (generic host reference — check your host's own docs):

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Hosting under a subfolder (like `/gitview/`)? Build with the right base — see the `--base` flag in the GitHub Pages section below.

## What is the publishing flow?

Three steps, repeated whenever the data should change:

1. On the machine with the token and clones: refresh the data (`pnpm collect`, or the ↻ button under `pnpm dev`) and run `pnpm build`.
2. Serve `dist/` from any static host, with the SPA fallback above.
3. Fresh data = repeat steps 1–2 periodically. A cron/CI job holding `GITVIEW_GITHUB_TOKEN` works — that is exactly what the demo's workflow does, minus the real data.

## How is the public demo deployed on GitHub Pages?

The live demo runs at https://enlighten-brasil.github.io/gitview/ — synthetic data only, no real team data. The workflow is `.github/workflows/pages.yml` ("Deploy demo"): it triggers on push to `main`, on `workflow_dispatch`, and on a monthly schedule (`0 6 1 * *`). The steps in order:

```bash
pnpm exec tsx scripts/make-demo-data.ts   # 100% synthetic fixture (devs "Ana"/"Beto", repos demo-*)
pnpm check:data                           # validates the fixture's shape + invariants before serving
pnpm exec vite build --base "<base_path>/"  # base computed by actions/configure-pages
cp dist/index.html dist/404.html          # SPA fallback for GitHub Pages
```

Then `actions/upload-pages-artifact` + `actions/deploy-pages` publish `dist/`. Two details worth knowing:

- **Dynamic base**: `actions/configure-pages` computes `base_path` (root on a user page, `/gitview/` on a project page) and the router matches it through `import.meta.env.BASE_URL` — one build works in both. Your own Pages deploy needs the same `--base` treatment if it lives under a subfolder.
- **The workflow never touches real data**: the fixture is generated fresh in CI and validated with `pnpm check:data` before the build.

:::info Why does the demo use synthetic data?
The fixture (`scripts/make-demo-data.ts`) generates fictional devs ("Ana"/"Beto"), fake commits and `demo-*` repos so the public demo never exposes a real team's data. Dates anchor to "today" (UTC) at build time, so the dashboard always covers the default 12M preset — the cost is a fixture that is not byte-identical across days. The script also refuses to overwrite existing `public/data/` without `--force`, so it can't swallow a dev machine's collection.
:::

:::info Why does the demo rebuild monthly?
The fixture anchors its dates to "today" at build time: without rebuilds the demo would age out of the short presets and look "dead". That's why `pages.yml` schedules a monthly rebuild ([issue #21](https://github.com/Enlighten-Brasil/gitview/issues/21)) — and because GitHub disables schedules after ~60 days of repo inactivity, manual `workflow_dispatch` stays available as a fallback.
:::

## Next steps

- [Development setup](../contributing/development.md) — run the project locally and validate changes before publishing.
- [Release ritual](../contributing/release.md) — how changes land, from changeset to `chore(release)`.
- [README — Publishing the dashboard](https://github.com/Enlighten-Brasil/gitview#publishing-the-dashboard-static-build) — the short version of this flow.
