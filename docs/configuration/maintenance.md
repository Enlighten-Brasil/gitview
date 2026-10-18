---
title: Data maintenance
description: What is regenerable, what survives cleanup, and when to re-collect all, clean and re-collect or delete data.
---

# Data maintenance

Everything the dashboard shows is generated data: the database and the JSONs rebuild themselves from the repositories. `.env` and `team.local.json` do not, and no cleanup ever touches them.

## What is regenerable

| path | regenerable | note |
|---|---|---|
| `data/gitview.db` (+ `-wal`/`-shm`) | yes | database recreated by the collectors |
| `public/data/*.json` | yes | the 5 JSONs the frontend reads |
| `data/repos/` | yes, but slow | bare clones; re-cloning is the expensive part |
| `.env` | **no** | machine config and the token |
| `team.local.json` | **no** | the team roster |

## The actions

| action | what it does | when to use |
|---|---|---|
| ↻ in the navbar, or `pnpm collect` | incremental collection, only what changed | day-to-day refresh |
| **salvar + recoletar** (`/teams`) | light re-collection: re-applies aliases, no git scan | you changed an identity or profile |
| **recoletar tudo** (re-collect all) | full collection without deleting the database | stale or incomplete numbers |
| **limpar e recoletar** (clean and re-collect) | wipes database + JSONs and runs the full collection | new config must apply to the whole history |
| **apagar dados** (delete data) | wipes without collecting and returns to the wizard | switching org or handing over the machine |

- The **Manutenção dos dados locais** (local data maintenance) card in **Config** → **Geral** holds the last three actions, with a live collector log. The card and the ↻ button exist on the dev server only.
- Cleaning before re-collecting is what fixes a number computed with the wrong config: new `GITVIEW_EXCLUDE_PATHS`, a removed alias, a merge still stored in the database.
- The **apagar também os clones (data/repos)** switch applies only to **apagar dados**; the next collection re-clones everything. After that the app returns to `/setup`, same as the first run.

## From the CLI

```bash
pnpm clean              # deletes data/gitview.db* + public/data/*.json
pnpm clean -- --repos   # also deletes the clones in data/repos
pnpm collect            # the 4 collectors in sequence + validation
```

The `--` before `--repos` is required: without it pnpm does not forward the flag. After `pnpm clean`, run `pnpm collect` (or ↻) to regenerate the JSONs.

:::warning
None of these actions deletes config or roster: to zero out the token and the team, delete `.env` and `team.local.json` by hand.
:::

## Next steps

- [The .env file](./env.md): the keys that define what is collected.
- [Team config (`team.local.json`)](./team.md): the file that is never regenerated.
- [Collectors](../architecture/collectors.md): the `--full` and `--reaggregate` flags.
