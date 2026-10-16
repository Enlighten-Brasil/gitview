# gitview

**Português (pt-BR):** [README.pt-BR.md](README.pt-BR.md)

An engineering-manager dashboard for team metrics: commits, PRs and releases across your GitHub org's repositories — everything runs locally and is strictly read-only over the repos it analyzes.

## Setup

Requirements:

- **Node 24+** (collectors use `node:sqlite` and read `.env` natively)
- **pnpm 10+**
- A GitHub account — authenticated through the UI itself (**device flow** or pasting a **PAT**), or via **GitHub CLI** (`gh auth login`), which works as a bridge when no token is set in `.env`

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev       # or pnpm start — http://localhost:5173 — first run lands on the /setup wizard
```

Nothing to copy or edit before running: `.env` is created automatically from `.env.example` on first run (`pnpm dev`, `pnpm start` or any collector).

### The `.env` (machine config — gitignored)

| key | what it's for |
|---|---|
| `GITVIEW_GITHUB_CLIENT_ID` | public OAuth/GitHub App Client ID with device flow enabled — prefilled in `.env.example`; empty disables the "Connect with GitHub" button |
| `GITVIEW_GITHUB_TOKEN` | token saved by the device flow/PAT. **It's the project's only secret** — when empty, falls back to `gh auth token` if the gh CLI is logged in |
| `GITVIEW_GITHUB_ORG` | default org for the setup wizard and team import |
| `GITVIEW_REPOS_ROOT` | folder holding the clones. Empty = `data/repos` (created by the setup) |
| `GITVIEW_DEFAULT_REPOS` | CSV of repos pre-selected in the setup (empty = all non-archived) |
| `GITVIEW_EXCLUDE` | CSV of folders skipped during repo discovery |
| `GITVIEW_EXCLUDE_PATHS` | CSV of generated-file globs excluded from line metrics (adds to the default lockfile/minified list). Only affects new commits — for history: `pnpm clean && pnpm collect` |
| `GITVIEW_PORT` | dev server port (default 5173) |

Precedence: shell variable → `.env` → default. The file is read **fresh** on every collector run (a new token takes effect without restarting the dev server). Windows paths: use forward slashes (`C:/Users/...`), or single quotes if they contain spaces.

> ⚠ **Upgrading from the old format**: if you still have `config.json`/`config.local.json` and haven't run anything from this release, run `pnpm dev` **before** pulling — the migration moves everything into `.env` + `team.local.json` (since then, each machine keeps its aliases in its own `team.local.json`; `pnpm clean` never deletes it).

### Team config (`team.local.json` — gitignored)

Dev profiles (title, description), aliases (commit e-mails, GitHub logins), teams and extra bots. All editable through the **/teams** screen (dev only; persisted via `/__team/config`). It is the single source of canonical names — without it the dashboard still works, every e-mail/login becomes its own author, and the collector lists the "candidates" for you to link up.

### Setup through the UI (`/setup`)

On first run (no collected data) the dashboard redirects to the 3-step wizard plus one optional step (`/setup/github` → `/setup/repos` → `/setup/collect` → `/setup/team`) — also reachable later via the **Config** item in the side rail (⚙, dev only; with data it opens **Settings** `/settings` directly):

1. **Connect GitHub** — device flow (the browser opens `github.com/login/device`, you type the code; the token lands in your `.env`), pasting a **PAT** (repo + read:org), or the `gh auth login` bridge. With a Client ID configured the button shows up; without one, the other paths still work.
2. **Choose repositories** — lists your org's repos (or your personal account's), with search and pre-selection from `GITVIEW_DEFAULT_REPOS`.
3. **Clone and collect** — creates bare clones in `data/repos/` and runs the first collection with live progress.
4. **(Optional) Define your team** — only appears when the first collection found unmapped identities (git authors/GitHub logins not linked to a dev yet) and takes you straight to the editor at `/teams#sem-mapeamento` (the dashboard UI is pt-BR); with no candidates the wizard goes right to the dashboard.

Clones in `data/repos/` are refreshed automatically with `git fetch` on every collection run (the token is injected through git environment variables, never written into the clone). You don't need the repos cloned anywhere, nor the `gh` CLI installed.

### Setup from the terminal (alternative)

`pnpm setup` runs the same clone flow in the terminal (uses the configured token — which may come from `gh`). Handy for automation.

### Pointing at existing clones

If you already have the repos cloned and prefer to use them, collectors look for the folder in this order:

1. `GITVIEW_REPOS_ROOT` environment variable
2. `GITVIEW_REPOS_ROOT` in the `.env`
3. Default: `data/repos` (the setup's managed clones)

In this mode the data reflects your local clones' state — `git pull` the repos before collecting if you want fresh numbers.

### Using it with another team/org

The project ships no machine or team data: `.env` and `team.local.json` are gitignored and created by each user (`.env.example` is the only template, with an example Client ID). Typical adjustments:

- `GITVIEW_GITHUB_ORG` / `GITVIEW_DEFAULT_REPOS` — org and setup pre-selection
- `GITVIEW_GITHUB_CLIENT_ID` — Client ID of your (or your org's) **GitHub App** (recommended, starts with `Iv…`) or **OAuth App** (`Ov…`) with **Device Flow enabled** (GitHub → Settings → Developer settings). Never add a client secret — the device flow doesn't use one.

> **Actually read-only**: use a **GitHub App** with *Repository → Contents: Read-only* (+ *Metadata*, automatic) installed on the org — the token it issues is physically incapable of writing. OAuth Apps and `gh auth login` use the `repo` scope, which is read+write: gitview only ever reads, and managed clones have their push URL locked (`remote.origin.pushurl=no-push`), but the real permission guarantee comes from the GitHub App.

### Cleaning up and starting over

The database and JSONs are 100% regenerable from the repositories (`team.local.json` is **not** — it's your team roster):

- **UI**: **Config → Geral** (`/settings`) → "Manutenção dos dados locais" card → *recoletar tudo* (full re-scan) or *limpar e recomeçar* (wipes database + JSONs and re-collects; clones are kept).
- **CLI**: `pnpm clean` (deletes `data/gitview.db*` + `public/data/*.json`) and then `pnpm collect`. `pnpm clean -- --repos` also deletes the clones (the next collection re-clones everything — slow).

## Commands

```bash
pnpm dev / start        # dashboard at http://localhost:5173 (navbar: ↻ re-collect, ⚙ opens the /setup wizard)
pnpm setup              # terminal wizard: choose/clone the org's repos
pnpm collect            # the 4 collectors in sequence + validation (incremental)
pnpm collect:github     # PRs/reviews only
pnpm collect:releases   # releases only
pnpm check:data         # shape validation of the generated JSONs
pnpm clean              # deletes database + JSONs (regenerable; --repos includes the clones)
pnpm build              # static build (dist/ — read-only, no setup endpoints)
pnpm changeset          # record a change
pnpm version:packages   # apply changesets (bump + CHANGELOG)
```

## Publishing the dashboard (static build)

The frontend only reads the JSONs in `public/data/` — `pnpm build` produces a 100% static `dist/`, with no server of its own. Publishing flow:

1. On the machine with the token and clones: refresh the data (`pnpm collect`, or the ↻ in the navbar under `pnpm dev`) and run `pnpm build`.
2. Serve `dist/` from any static host (GitHub Pages, Netlify, nginx…). It needs **SPA fallback**: deep links like `/devs/<name>` must serve `index.html` (the router uses `createWebHistory`).
3. Fresh data = repeat steps 1–2 periodically (a cron/CI job with the token works).

**In the static build the dashboard is read-only**: `/setup`, `/settings` and collection (↻) don't exist, and the `/teams` editor is disabled — the `/__*` endpoints are dev-server middleware (details in `CONTRIBUTING.md`, currently pt-BR). Unify identities and tune teams in dev, re-collect, then publish.

## Conventions

- Every change = changeset (`minor` feature / `patch` fix) → `pnpm version:packages` → a single commit with `chore(release): X.Y.Z` in the body.
- Commit messages in pt-BR (Conventional Commits), code in English, comments in pt-BR.
- `data/` (database + clones), `public/data/`, `.env` and `team.local.json` are local and gitignored.
- Architecture details and filter rules: see `AGENTS.md`.
