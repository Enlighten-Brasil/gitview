---
title: The .env file
description: "The GITVIEW_* keys in .env: defaults, shell-vs-file precedence, and the format of each value."
---

# The `.env` file

The `.env` holds the machine config: GitHub credentials, where the clones live, what to skip and which timezone the charts use. It is gitignored, it carries the project's only secret (`GITVIEW_GITHUB_TOKEN`), and it is created from `.env.example` on the first run of `pnpm dev`, `pnpm start` or any collector.

## GitHub

| key | what it does | default |
|---|---|---|
| `GITVIEW_GITHUB_CLIENT_ID` | enables the **Conectar com GitHub** button | example `Ov…` value in the template |
| `GITVIEW_GITHUB_TOKEN` | token used for collection | empty → `gh auth token` |
| `GITVIEW_GITHUB_ORG` | default org for setup | empty |

- The Client ID is public: the device flow uses no client secret. Without it, paste a PAT or use a logged-in `gh`, see [Connecting GitHub](../guide/connecting-github.md).
- The token is stored in plain text in `.env`: the file is in `.gitignore` and the dev server refuses to serve it.
- `GITVIEW_GITHUB_ORG` is also the org suggested by **importar do GitHub** on the `/teams` screen.

## Repositories

| key | what it does | default |
|---|---|---|
| `GITVIEW_REPOS_ROOT` | folder holding the repo clones | empty → `data/repos` |
| `GITVIEW_DEFAULT_REPOS` | repos pre-selected in setup | empty → all non-archived |
| `GITVIEW_PRODUCTION_REF` | branch treated as production | empty → auto per repo |
| `GITVIEW_INTEGRATION_REFS` | integration branches (CSV) | `develop,staging` |

- List keys are CSV, comma-separated with no spaces at the edges: `GITVIEW_DEFAULT_REPOS=repo-a, repo-b`.
- `GITVIEW_REPOS_ROOT` accepts an absolute path or one relative to the project root. On Windows use forward slashes (`C:/dev/repos/api`).
- Setup writes the key when the clone finishes. To read clones you maintain yourself, see [Repositories](../guide/repositories.md).
- `GITVIEW_PRODUCTION_REF` is global with a per-repo fallback: when the ref does not exist in a clone, that repo falls back to auto-detection (`origin/HEAD` → `HEAD` → `main` → `master`) and a warning names the repo. A repo with commits and no resolvable production ref is an error, never a silent empty value.
- `GITVIEW_INTEGRATION_REFS` is filtered per repo: branches missing from a clone drop out of its list. An empty result is legitimate and prints nothing.
- Both ref keys are also editable in the app: the **Refs dos repositórios** card in **Config → Geral** (dev server only) saves them to `.env` and shows, as a read-only hint, the resolved value per repo — what the collection will actually use, including the per-repo fallbacks.

## Branches

| key | what it does | default |
|---|---|---|
| `GITVIEW_BRANCH_STALE_DAYS` | days without activity for a branch with no unmerged work (`aheadProd = 0` and `aheadInt` null or 0) to be classified as `pousada` in `branches.json` | `30` |
| `GITVIEW_BOT_BRANCHES` | exact branch names treated as bot branches (CSV) | empty → prefix pattern only |

- `collect-branches.ts` gives every branch exactly one status of a closed union: `production`, `integration`, `feature`, `bot` or `pousada`. Bot branches match the `dependabot/` or `renovate/` prefix (`BOT_BRANCH_RE` in `scripts/lib/team.ts`); `GITVIEW_BOT_BRANCHES` adds exact names, compared case-insensitively. GitHub bot *logins* (`githubBots` in `team.local.json`) match logins, not ref names — they do not classify branches.
- `GITVIEW_BRANCH_STALE_DAYS` accepts an integer ≥ 0; empty or invalid falls back to the default 30, which matches a monthly release cycle. `pousada` also requires `aheadProd = 0` and `aheadInt` null or 0 — an old branch with unmerged work (ahead of production or of the integration ref) stays `feature`.
- `branches.json` is pure git fact: `authorsAhead` carries raw commit e-mails (`%ae`), never canonical names, and the line counts sum the raw numstat. Alias/team edits reflect without re-collecting — the frontend maps e-mail→dev via `team.json#devs[].emails`.

## Graph

| key | what it does | default |
|---|---|---|
| `GITVIEW_GRAPH_WINDOW` | commits per repo in the topology file `graph-<repo>.json` (commit graph, with merges) | `1000` |

- `collect-graph.ts` writes one file per repo with the last `GITVIEW_GRAPH_WINDOW` commits of all refs (`git log --all --date-order`), including merges — they are the connectors of the graph drawing. The file feeds neither the database nor the metrics: the `--no-merges` decision is untouched.
- The window is a COUNT of commits, not days: the period covered varies with each repo's velocity (1000 commits ≈ 87 days at the team's current pace).
- Accepts an integer > 0; empty counts as not set. An invalid value (0, negative, non-numeric) prints a warning and falls back to the default 1000.
- Only the full collection generates the files (`pnpm collect`, `pnpm collect:full` / **recoletar tudo**); the light re-collection leaves existing `graph-*.json` untouched, and a repo without its file is a non-blocking warning in `check-data` (the UI shows an empty state).

## Metrics and data

| key | what it does | default |
|---|---|---|
| `GITVIEW_TIMEZONE` | timezone of all time buckets | `America/Sao_Paulo` |
| `GITVIEW_EXCLUDE_PATHS` | globs added to the line exclusions | empty → built-in list only |

- `GITVIEW_TIMEZONE` takes an IANA name (`Europe/Lisbon`, `UTC`). Day, month, ISO week, night hours and heatmap come from it, not from the machine clock. An invalid timezone prints a warning and falls back to `America/Sao_Paulo`.
- `GITVIEW_EXCLUDE_PATHS` **adds to** the built-in list, never replaces it: `GITVIEW_EXCLUDE_PATHS='themes/**/vendor/**,docs/api/**'`. It only applies to commits scanned after the change. For history, use **limpar e recoletar** (clean and re-collect), see [Data maintenance](./maintenance.md).

These generated files stay out of the +/− line metrics (their commits still count):

```text
package-lock.json  pnpm-lock.yaml  yarn.lock  bun.lock  bun.lockb
Cargo.lock  composer.lock  Gemfile.lock  poetry.lock  Pipfile.lock
pubspec.lock  Package.resolved  go.sum
*.min.js  *.min.css  *.min.map  *.snap  *.generated.ts  *.generated.js  *.designer.cs  *.apidog.json
dist/**  documentation/**  full_documentation.json  overwrites/**  .git-rewrite/**
```

## How values are resolved

- **shell → `.env` → default.** The shell variable wins. Empty or whitespace-only counts as not set; `GITVIEW_GITHUB_ORG=` means "the key exists, disabled".
- `.env` is re-read on every collector run: a swapped token takes effect on the next collection, no restart.
- A new `.env.example` key missing from your `.env` triggers a warning (once per process): `! .env sem chaves novas do .env.example: ...`. Copy the line, or delete `.env` and run any collector to recreate it from the template.
- The UI writes line by line and preserves comments and order, with the value in single quotes (`GITVIEW_REPOS_ROOT='C:/dev/my repos'`). The parser does not expand escapes inside single quotes. A value containing a single quote or a line break is rejected.
- Team data does not land here: it goes to [`team.local.json`](./team.md).

## Next steps

- [Team config (`team.local.json`)](./team.md): profiles, aliases, teams and bots.
- [Data maintenance](./maintenance.md): what is regenerable and how to reset.
