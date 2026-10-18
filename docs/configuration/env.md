---
title: The .env file
description: Every GITVIEW_* key with default and format — precedence, fresh reads, quoting, Windows paths and the legacy config.json migration.
---

# The `.env` file

The `.env` file holds the machine-level configuration: GitHub credentials, where the clones live, what to skip during scans and which timezone the time buckets use. It is gitignored, created automatically from `.env.example` on first run, and carries the project's **only secret** (`GITVIEW_GITHUB_TOKEN`).

## All keys at a glance

| key | what it does | default | format |
|---|---|---|---|
| `GITVIEW_GITHUB_CLIENT_ID` | Public Client ID of an OAuth App (`Ov…`) or GitHub App (`Iv…`) with device flow enabled — shows the **Conectar com GitHub** button in the setup wizard | empty (`.env.example` ships with an example) | string |
| `GITVIEW_GITHUB_TOKEN` | Token written by the device flow, a pasted PAT or the setup UI. **Never commit it** | empty → falls back to `gh auth token` when the GitHub CLI is logged in | token string |
| `GITVIEW_GITHUB_ORG` | Default org for the setup wizard and for the team import on `/teams` | empty | org login |
| `GITVIEW_REPOS_ROOT` | Folder holding the repository clones | empty → `data/repos` (created by the setup) | absolute path or path relative to the repo root |
| `GITVIEW_DEFAULT_REPOS` | Repos pre-selected in the setup wizard | empty = all non-archived repos | CSV |
| `GITVIEW_EXCLUDE` | Folders skipped during repo discovery | empty | CSV |
| `GITVIEW_EXCLUDE_PATHS` | Generated-file globs excluded from line metrics — adds to the built-in list below | empty = built-in list only | CSV of globs |
| `GITVIEW_PORT` | Dev server port (`pnpm dev` / `pnpm start`) | `5173` | integer 1–65535 (out-of-range values are ignored) |
| `GITVIEW_TIMEZONE` | IANA timezone of every time bucket (month, day, ISO week, weekend, night, heatmap) | `America/Sao_Paulo` | IANA name (`America/Sao_Paulo`, `Europe/Lisbon`, `UTC`) |

CSV values are comma-separated with surrounding whitespace trimmed (e.g. `repo-a, repo-b`). An empty line like `GITVIEW_GITHUB_ORG=` means "key exists, disabled".

## How values are resolved

- **Precedence: shell variable → `.env` → default.** A shell variable always wins, even when the `.env` has a value. Empty or whitespace-only counts as "not set".
- **Fresh read on every call.** The file is parsed on each collector run and is never loaded into the process environment, so a new token takes effect without restarting the dev server.
- **First run creates the file.** `pnpm dev`, `pnpm start` or any collector copies `.env.example` into `.env` when it doesn't exist. When `.env.example` gains keys your `.env` doesn't have, the run prints a one-time warning listing them.
- **The setup UI writes keys back line by line** (via `saveConfig()`), preserving comments and order; new keys are appended at the end. Team data never lands here — it goes to [`team.local.json`](./team.md).

:::info Why is .env re-read on every run?
The collectors run as children of the dev server and read the file at each invocation instead of inheriting a snapshot of the environment. That is what makes the token hot-swappable: paste a new PAT in the UI (or edit the file) and the very next collection uses it — no restart, no stale credential lingering in memory.
:::

## Quoting and Windows paths

- Values written by the setup UI are wrapped in **single quotes** (`GITVIEW_REPOS_ROOT='C:/dev/my repos'`). The parser does no escape expansion inside single quotes.
- A value cannot contain a single quote or a line break — the UI refuses to write it.
- On Windows use forward slashes (`C:/dev/repos/api`); add single quotes when the path contains spaces.

## The built-in line-metric exclusions

`GITVIEW_EXCLUDE_PATHS` **adds** patterns to this list — it never replaces it. The built-ins keep generated files out of the +/− line metrics:

```text
package-lock.json   pnpm-lock.yaml      yarn.lock          bun.lock
bun.lockb           Cargo.lock          composer.lock      Gemfile.lock
poetry.lock         Pipfile.lock        pubspec.lock       Package.resolved
go.sum              *.min.js            *.min.css          *.min.map
*.snap              *.generated.ts      *.generated.js     *.designer.cs
```

Without them a `chore: update version` commit drags +300k of lockfile into the numbers and distorts every chart. Example:

```bash
GITVIEW_EXCLUDE_PATHS='themes/**/vendor/**,docs/api/**'
```

Only commits scanned *after* the change respect the new globs — to re-apply them to the collected history, wipe and collect again (`pnpm clean && pnpm collect`, see [Data maintenance](./maintenance.md)).

:::info Why does the timezone live in .env?
Every time bucket (day, month, ISO week, weekend, night, heatmap) is computed in one canonical IANA timezone instead of the clock of the machine that collects. The same database then produces the same buckets on any machine, and a colleague in another timezone reading the same data sees identical charts — see [issue #8](https://github.com/Enlighten-Brasil/gitview/issues/8).
:::

## Coming from the legacy config.json / config.local.json

Older releases kept config in a versioned `config.json` (aliases, org, exclusions) plus a gitignored `config.local.json` (token, repos root, profiles, teams). The migration to the current format is **one-shot and idempotent**, runs automatically the first time `loadConfig()` sees a `config.local.json`, and routes each field to its new home:

| legacy field | new home |
|---|---|
| `githubToken`, `reposRoot` (from `config.local.json`) | `.env` (shell variables still win) |
| `githubOrg`, `oauthClientId`, `defaultRepos`, `exclude` (from `config.json`) | `.env` |
| `authors`, `githubUsers`, `devProfiles`, `teams`, `bots`, `githubBots` | `team.local.json` (aliases merged without duplicates) |

After migrating, `config.local.json` is renamed to `config.local.json.migrated` (history preserved, still gitignored) and the migration becomes a no-op.

:::warning
If your machine still has the old files, run `pnpm dev` **before** pulling the release that removed `config.json` — the migration needs the old file in place. If you pull first, nothing is lost: re-map the aliases on the [`/teams`](./team.md) screen.
:::

## Next steps

- [Team config (`team.local.json`)](./team.md) — dev profiles, aliases, teams and bots.
- [Data maintenance](./maintenance.md) — what is regenerable and how to reset it.
