---
title: Data maintenance
description: What is regenerable, what is not, and when to use recoletar tudo, limpar e recoletar or apagar dados — UI and CLI.
---

# Data maintenance

Everything the dashboard shows is generated data: the SQLite database and the JSONs in `public/data/` are 100% regenerable from the repositories. Your `.env` and `team.local.json` are not — and no cleanup ever touches them.

## What is regenerable (and what is not)

| path | regenerable | notes |
|---|---|---|
| `data/gitview.db` (+ `-wal`/`-shm`) | yes | SQLite database rebuilt by the collectors |
| `public/data/*.json` | yes | `stats.json`, `commits.json`, `github.json`, `releases.json`, `team.json` — the static build reads only these |
| `data/repos/` | yes, but slow | managed bare clones; the next collection re-clones everything |
| `.env` | **no** | machine config + the GitHub token |
| `team.local.json` | **no** | your team roster — canonical names, aliases, teams, bots |

## The "Manutenção dos dados locais" card

Open **Config** → **Geral** (`/settings`; dev only — the card doesn't exist in the static build). The **Manutenção dos dados locais** card has three actions and a switch:

| action | what it does | when to use |
|---|---|---|
| **recoletar tudo** | Runs a complete collection (`/__collect?full=1`) without deleting anything | Numbers look stale or incomplete but you want to keep the database |
| **limpar e recoletar** | Asks "Limpar e recoletar?", wipes database + JSONs and runs a complete collection (`/__collect?full=1&clean=1`); clones untouched | A config change must be re-applied to the whole history (e.g. `GITVIEW_EXCLUDE_PATHS`), or the database looks inconsistent |
| **apagar dados** | Asks "Apagar os dados locais?", wipes without collecting (`GET /__clean`) and returns to the setup wizard | Starting over — switching org/repos, handing the machine to someone else |

The switch **apagar também os clones (data/repos)** also removes the managed clones on **apagar dados** — the next collection re-clones everything (slow). While an action runs, the card streams the collector log; on success it shows **dados regenerados com sucesso**.

After **apagar dados** the app drops the in-memory "has data" state (`stats` + `resetBoot()`) and navigates to `/setup` without a reload — every data route now falls through to the wizard until the next collection, which is exactly the first-run behavior.

:::info Why does changing GITVIEW_EXCLUDE_PATHS need limpar e recoletar?
Line metrics are computed at collection time and stored in the database and JSONs — the exclusion globs only apply to commits scanned from then on. The old numbers were already counted without the new patterns, so re-scanning on top of them would leave the history inconsistent. Only a wipe rebuilds every commit's lines under the new list.
:::

:::info Why do the clones survive the default cleanup?
Re-cloning is the expensive part of a rebuild (network + full history), while the database and JSONs rebuild in minutes from the clones already on disk. So the default cleanup keeps `data/repos/` and only the explicit flag — **apagar também os clones (data/repos)** or `pnpm clean -- --repos` — removes them.
:::

## The CLI equivalent

```bash
pnpm clean              # deletes data/gitview.db* + public/data/*.json
pnpm clean -- --repos   # also deletes the managed clones (next collection re-clones — slow)
pnpm collect            # the 4 collectors in sequence + validation (incremental)
```

The CLI wipe is the same code as **apagar dados** (`scripts/lib/clean.ts`) — including the guarantee that `.env` and `team.local.json` survive. After `pnpm clean`, run `pnpm collect` (or hit the ↻ button in the navbar) to regenerate the JSONs; the console reminds you of exactly that. Note the `--` before `--repos`: pnpm needs it to forward the flag.

## Choosing the right action

- **Daily refresh** — the ↻ button or `pnpm collect`: incremental, adds new commits/PRs/releases on top of what is already collected.
- **recoletar tudo** — runs all collectors in complete mode (`/__collect?full=1`) without losing the database.
- **limpar e recoletar** — the fix for "the numbers were computed with the wrong config": changed `GITVIEW_EXCLUDE_PATHS`, suspects leftovers after a collector bug, or a mismatch between the database and the JSONs. Equivalent to `pnpm clean` + `pnpm collect`.
- **apagar dados** — wipe without rebuilding: the dashboard goes back to the setup wizard and waits for you to choose repos and collect again.

:::warning
**apagar dados** and `pnpm clean` delete collected data only. Identity mappings, teams and the token live in `team.local.json` and `.env` — see [Team config](./team.md) and [The .env file](./env.md) before you hand the machine over.
:::

## Next steps

- [The .env file](./env.md) — the keys that shape what gets collected.
- [Team config (`team.local.json`)](./team.md) — the one file that is never regenerated.
