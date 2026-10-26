---
title: Publishing the static build
description: Generate the dist with pnpm build, serve it with an SPA fallback, and keep the gitview demo on GitHub Pages.
---

# Publishing the static build

`pnpm build` generates a 100% static `dist/`: HTML, JS, CSS and the collected JSONs. No runtime server, no database, no git. Any static host serves it.

## What goes into the build

The dashboard reads only the JSONs in `public/data/`: the 8 fixed ones — `stats.json`, `daily.json`, `commits.json`, `report-commits.json`, `github.json`, `branches.json`, `releases.json`, `team.json` — plus one `graph-<repo>.json` per repository for the commit graph. Nothing is recalculated from git in the browser. New data means a new build: run `pnpm collect` before publishing. `report-commits.json` is lazy and has no UI consumer yet, but it is still published in full: canonical author names and stored commit subjects (limited to 500 characters) become publicly readable with the static artifact. Lazy loading is not access control.

## What doesn't exist in the static build

The write endpoints (`/__setup/*`, `/__auth/*`, `/__collect`, `/__clean`, `/__team/config`, `/__team/github`) are dev-server middleware and don't enter the `dist/`.

| Feature | `pnpm dev` | static build |
|---|---|---|
| `/setup` (wizard) | works | doesn't exist |
| `/settings` | works | doesn't exist |
| Re-collect button (↻) | works | doesn't render |
| Editing in `/teams` | works | disabled |
| Data for `/teams` and `/repos` | render | render |

Unify identities and adjust the teams in dev, re-collect, and only then publish: config made through the UI never reaches an already-published `dist/`.

## SPA fallback

The router uses `createWebHistory`: `/devs/<name>` is a real URL. On a refresh or a direct link the host must answer `index.html` for a nonexistent path, or the deep link dies on the server's 404.

- **GitHub Pages**: no rewrite rules. Copy the entry file: `cp dist/index.html dist/404.html`.
- **Netlify**: `_redirects` at the published root.

```text
/*  /index.html  200
```

- **nginx**:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

- **Subfolder**: pass the base at build time, e.g. `pnpm exec vite build --base "/gitview/"`.

## Publishing flow

1. On the machine with the token and clones, refresh the data: `pnpm collect` (or the ↻ button in `pnpm dev`).
2. Generate the build: `pnpm build`.
3. Publish `dist/` with the SPA fallback above.
4. Repeat steps 1 and 2 on a cron or CI job with `GITVIEW_GITHUB_TOKEN`.

Commands and gates are in [Development setup](../contributing/development.md); the path from change to release is in [Release ritual](../contributing/release.md).

## Demo deploy on GitHub Pages

The demo at https://enlighten-brasil.github.io/gitview/ comes from `.github/workflows/pages.yml`, triggered on push to `main`, on `workflow_dispatch` and on the monthly cron `0 6 1 * *`:

```bash
pnpm exec tsx scripts/make-demo-data.ts   # synthetic fixture for the ten JSONs (eight fixed + two demo graphs)
pnpm check:data                           # validates the fixture before the build
pnpm exec vite build --base "<base_path>/"
cp dist/index.html dist/404.html          # SPA fallback
DOCS_BASE="<base_path>/docs/" pnpm docs:build
cp -r docs/.vitepress/dist dist/docs
```

- `actions/configure-pages` computes the `base_path`: root on a user page, `/gitview/` on a project page. The router uses `import.meta.env.BASE_URL`, so one build serves both cases.
- The docs site ships in the same artifact, under `dist/docs/`. Its base comes from `DOCS_BASE`; locally `pnpm docs:dev` and `pnpm docs:preview` run with `DOCS_BASE=/`.
- The fixture is generated from scratch in CI, with fictional devs ("Ana"/"Beto") and `demo-*` repos. The script refuses to overwrite an existing `public/data/` without `--force`.
- The fixture's dates anchor to today (UTC) at build time, which is why the monthly rebuild keeps the demo inside the short period presets. GitHub disables schedules after ~60 days without activity in the repo: run `workflow_dispatch` in that case.
