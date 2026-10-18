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

- List keys are CSV, comma-separated with no spaces at the edges: `GITVIEW_DEFAULT_REPOS=repo-a, repo-b`.
- `GITVIEW_REPOS_ROOT` accepts an absolute path or one relative to the project root. On Windows use forward slashes (`C:/dev/repos/api`).
- Setup writes the key when the clone finishes. To read clones you maintain yourself, see [Repositories](../guide/repositories.md).

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
*.min.js  *.min.css  *.min.map  *.snap  *.generated.ts  *.generated.js  *.designer.cs
```

## How values are resolved

- **shell → `.env` → default.** The shell variable wins. Empty or whitespace-only counts as not set; `GITVIEW_GITHUB_ORG=` means "the key exists, disabled".
- `.env` is re-read on every collector run: a swapped token takes effect on the next collection, no restart. `GITVIEW_PORT` is the exception, read at boot.
- A new `.env.example` key missing from your `.env` triggers a warning (once per process): `! .env sem chaves novas do .env.example: ...`. Copy the line, or delete `.env` and run any collector to recreate it from the template.
- The UI writes line by line and preserves comments and order, with the value in single quotes (`GITVIEW_REPOS_ROOT='C:/dev/my repos'`). The parser does not expand escapes inside single quotes. A value containing a single quote or a line break is rejected.
- Team data does not land here: it goes to [`team.local.json`](./team.md).

## Advanced settings

- `GITVIEW_EXCLUDE`: folders skipped during repo discovery. Matches the exact subfolder name, it is not a glob (`node_modules, tmp`). Empty by default.
- `GITVIEW_PORT`: dev server port, default `5173`. Accepts an integer from 1 to 65535; anything outside is ignored. Changing it requires restarting `pnpm dev`.

## Next steps

- [Team config (`team.local.json`)](./team.md): profiles, aliases, teams and bots.
- [Data maintenance](./maintenance.md): what is regenerable and how to reset.
