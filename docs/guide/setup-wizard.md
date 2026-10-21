---
title: The setup wizard
description: "What each /setup step does: connect GitHub, pick repos, clone, collect and set up the team."
---

# The setup wizard

With no collected data, the wizard (route `/setup`) is the only way in: it connects GitHub, clones the repos you pick and runs the first collection. Three steps plus one optional. The UI shows **Configurar gitview** with the indicator "passo 1 de 3 — conectar o GitHub".

| step | route | what it does |
|---|---|---|
| 1 · connect GitHub | `/setup/github` | authenticates via device flow, PAT or `gh` bridge |
| 2 · choose repositories | `/setup/repos` | picks the org, ticks the repositories |
| 3 · clone and collect | `/setup/collect` | bare clones in `data/repos/`, first collection |
| 4 · set up the team (optional) | `/setup/team` | links unmapped identities to devs |

## Step 1: connect GitHub

Follow one of the three authentication paths in [Connecting GitHub](./connecting-github.md). When the status shows **Conectado como @\<login\>**, the **continuar** button moves to step 2.

## Step 2: choose repositories

Pick the org, search and tick the repositories; the **clonar e coletar** (clone and collect) button moves on. Pre-selection comes from `GITVIEW_DEFAULT_REPOS` (empty = all non-archived) and the selection survives F5. Picker details are in [Repositories](./repositories.md).

## Step 3: clone and collect

One screen, two phases:

1. **clone**: the missing repos become bare clones in `data/repos/`, in parallel;
2. **collect**: the first collection runs with live progress in an expandable log.

Switching routes does not interrupt the run; when you come back, the log continues where it stopped. At the end, **abrir dashboard** (open dashboard) moves to step 4 (or straight to the dashboard) and **voltar** (back) returns to step 2. What lands on disk: the clones, the database at `data/gitview.db` and the JSONs in `public/data/`. Those JSONs are validated at the end of every collection; if validation fails, the collection fails.

## Step 4: set up the team (optional)

Only appears when the collection found git authors or GitHub logins without a mapping. **unificar agora** (unify now) opens the identity editor at `/teams#sem-mapeamento`; **pular — abrir dashboard** (skip, open dashboard) goes straight to the dashboard. With no candidates the screen shows **Nenhuma identidade sem mapear** (no unmapped identities) and **abrir dashboard** moves on directly. It is the only `/setup` route that stays accessible once data exists.

## Reopening later

With collected data, `/setup` redirects to Settings (`/settings`, the **Config** item in the rail, dev only). There you manage repositories and use **recoletar tudo** (re-collect everything), **limpar e recoletar** (clear and re-collect) or **apagar dados** (delete data); each action's effect is in [Data maintenance](../configuration/maintenance.md).

:::warning
The wizard and Settings only exist in the dev server. In the static build (`pnpm build`), `/setup` shows the alert **Setup disponível apenas em modo dev** (setup available in dev mode only). With no collected data in the dist, the alert also explains what is missing and links out to the project documentation.
:::

## From the terminal

`pnpm setup` runs the same clone flow in the terminal:

```bash
pnpm setup              # interactive picker ("all" = non-archived, Enter = GITVIEW_DEFAULT_REPOS)
pnpm setup -- --yes     # no questions; requires GITVIEW_GITHUB_ORG
```

It uses the token from `.env` (or from `gh`, if logged in), clones the missing repos into `data/repos/` and writes `GITVIEW_REPOS_ROOT=data/repos` to `.env`. If a repos folder already exists outside `data/repos`, it asks before migrating. At the end it prints the next commands.
