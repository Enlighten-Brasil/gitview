---
title: Quickstart
description: Clone, pnpm install and pnpm dev — nothing to edit by hand — and you reach the /setup wizard in minutes.
---

# Quickstart

From clone to first dashboard in a few minutes. You need Node 22.13+, pnpm 11.28 and a GitHub account — there is nothing to copy or edit before the first run.

## What do I need?

- **Node 22.13+** — the collectors use `node:sqlite`, flag-free since 22.13 (the CI runs Node 22).
- **pnpm 11.28** — pinned in the `packageManager` field of `package.json` (`pnpm@11.28.6`). Run `corepack enable` once, or install pnpm 11.28 directly.
- **A GitHub account** — you authenticate through the UI itself (device flow or pasting a PAT) or through the GitHub CLI (`gh auth login`) bridge. See [Connecting GitHub](./connecting-github.md).

## Install and run

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev
```

`pnpm start` is an alias of `pnpm dev`. Both serve the dashboard at `http://localhost:5173`.

## What happens on the first run?

Nothing to copy or edit: `.env` is created automatically from `.env.example` on the first run (`pnpm dev`, `pnpm start` or any collector). The `.env` holds the machine config (token, org, repos folder) and is gitignored — as is `team.local.json`, your team roster.

With no collected data, every data route leads to the **setup wizard** (`/setup`): `/setup/github` → `/setup/repos` → `/setup/collect` → `/setup/team`.

## What should I see?

The wizard opens with the title **Configurar gitview** and the step indicator **passo 1 de 3 — conectar o GitHub**. (The dashboard UI is pt-BR: labels stay exactly as they appear on screen, in every language of this doc.)

Step 1 offers three paths to authenticate — see [Connecting GitHub](./connecting-github.md). With a `GITVIEW_GITHUB_CLIENT_ID` set (the `.env.example` ships with an example one), the **Conectar com GitHub** button appears; without it, pasting a PAT and the `gh auth login` bridge still work.

:::info Por que o .env se cria sozinho?
The repo versions no machine config — `.env.example` is the only template. Creating `.env` on first run means clone → `pnpm install` → `pnpm dev` works with zero editing, and no token or personal data ever gets committed. `pnpm clean` never deletes it.
:::

## Next steps

- [The setup wizard](./setup-wizard.md) — what each step does and how to reopen it later.
- [Connecting GitHub](./connecting-github.md) — device flow, PAT or the `gh` bridge.
- [Repositories](./repositories.md) — pick the repos and understand the clones.
