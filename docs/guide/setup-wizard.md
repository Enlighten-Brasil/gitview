---
title: The setup wizard
description: What each /setup step does, what lands in data/repos/, and how to reopen the wizard later — or run pnpm setup in the terminal.
---

# The setup wizard

On first run the wizard (route `/setup`) connects GitHub, clones the repos you pick and runs the first collection. Three steps plus one optional — and it is the only way in until there is collected data.

## What are the steps?

The wizard renders outside the dashboard shell (no rail/navbar) with the title **Configurar gitview** and a step indicator like **passo 1 de 3 — conectar o GitHub** (the UI is pt-BR; labels stay as on screen). The sequence:

| # | route | step label (UI) | what it does |
|---|---|---|---|
| 1 | `/setup/github` | **conectar o GitHub** | authenticate (device flow / PAT / `gh` bridge) |
| 2 | `/setup/repos` | **escolher repositórios** | pick org and repos |
| 3 | `/setup/collect` | **clonar e coletar** | bare clones in `data/repos/` + first collection |
| 4 (optional) | `/setup/team` | **definir o time** | link unmapped identities to devs |

### Step 1 — connect GitHub

The card **Conectar sua conta do GitHub** offers the three authentication paths (see [Connecting GitHub](./connecting-github.md)). When the status shows **Conectado como @\<login\>**, the **continuar** button goes to step 2.

### Step 2 — choose repositories

The card **Quais repositórios entram no dashboard?** lists the org's repos from the GitHub API: pick the org in **organização** (your orgs plus a `<login> (pessoal)` entry), filter with **buscar repositórios**, tick what enters. Pre-selection comes from `GITVIEW_DEFAULT_REPOS` (CSV in `.env`; empty = all non-archived repos). Quick picks: **padrão do time** (the CSV), **todos**, **nenhum**. Archived repos show the **arquivado** badge and can't be selected. The selection survives F5 (kept in sessionStorage). The submit button is **clonar e coletar**.

### Step 3 — clone and collect

One screen, two phases (panel **Clonar e coletar**):

1. **clone** — the missing repos become bare clones in `data/repos/`, in parallel (pool of 4);
2. **collect** — the first collection runs with live progress over SSE (the log is expandable).

Changing routes does not kill the run: come back and the log continues where it stopped. When both phases finish, **abrir dashboard** appears (**voltar** goes back to step 2 while idle).

What lands on disk: `data/repos/<repo>` (clones), `data/gitview.db` (SQLite) and `public/data/*.json` (stats, commits, PRs, releases, team). The JSONs are validated at the end of every collection (`check-data.ts`) — a validation error fails the collection.

### Step 4 — define the team (optional)

Only appears when the first collection found candidates — git authors and GitHub logins not linked to any dev. The card counts them ("N identidades aparecem sem mapear"); **unificar agora** takes you to the identity editor at `/teams#sem-mapeamento` and **pular — abrir dashboard** skips it. With no candidates the card shows **Nenhuma identidade sem mapear** and **abrir dashboard** goes straight to the dashboard. This is the only `/setup/*` route that survives having data — you can return to it later.

:::info Por que os clones são bare?
A bare clone has no working tree — only refs and objects. The collectors read `git log` and `git tag` from those, never from a checkout, so the clones are smaller and refresh faster. Unifying identities later rewrites names already in the database only on a re-collection — that is why step 3 can run again from Settings.
:::

## How do I reopen it later?

Once there is data, `/setup` redirects to Settings (`/settings`) — the wizard is a first-run flow. The rail item **Config** (⚙, dev only) opens Settings. There you get:

- **gerenciar repositórios** — the same picker in manage mode: current repos come pre-selected with the **atual** badge; unchecking one warns that its clone will be deleted from disk, and **aplicar mudanças** asks for confirmation (**Apagar repositórios do disco?** → **apagar e aplicar**). Removal is always explicit.
- **Manutenção dos dados locais** card — **recoletar tudo** (full re-scan), **limpar e recoletar** (wipe database + JSONs, then re-collect) and **apagar dados** (wipe without re-collecting — returns to the wizard; the clones stay unless you tick **apagar também os clones (data/repos)**).

:::warning The wizard and Settings exist only in the dev server (`pnpm dev` / `pnpm start`). In the static build (`pnpm build`) the `/__*` endpoints don't exist and `/setup` shows the alert **Setup disponível apenas em modo dev**.
:::

## What about the terminal?

`pnpm setup` runs the same clone flow in the terminal — handy for automation:

```bash
pnpm setup              # interactive picker ("all" = non-archived, Enter = GITVIEW_DEFAULT_REPOS)
pnpm setup -- --yes     # no questions: GITVIEW_DEFAULT_REPOS, else all non-archived
```

It uses the configured token (which may come from `gh`), clones the missing repos into `data/repos/` and writes `GITVIEW_REPOS_ROOT=data/repos` to the `.env`. If a working repos folder already exists outside `data/repos`, it asks before migrating (**Migrar pros clones gerenciados em data/repos? [y/N]**). At the end it prints the next commands (`pnpm collect`, `pnpm dev`).

## Next steps

- [Connecting GitHub](./connecting-github.md) — pick the credential.
- [Repositories](./repositories.md) — how the clones work and how to point at your own.
- [Reference: .env keys](../configuration/env.md) — every `GITVIEW_*` key.
