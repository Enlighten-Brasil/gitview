---
title: Quickstart
description: "From clone to first dashboard: pnpm install, pnpm dev and the setup wizard. Nothing to edit beforehand."
---

# Quickstart

## Prerequisites

- **Node 22.13+**: required for the collectors' `node:sqlite`.
- **pnpm 11.28**: pinned in the `packageManager` field of `package.json`. Run `corepack enable` once, or install pnpm 11.28.
- **A GitHub account**: authentication happens in the UI (device flow or PAT) or through the `gh auth login` bridge. See [Connecting GitHub](./connecting-github.md).

## Install and run

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev
```

`pnpm start` is an alias for `pnpm dev`. Both serve the dashboard at `http://localhost:5173`.

## First run

Nothing to copy or edit beforehand: `.env` is created automatically from `.env.example` on the first run. The machine keys live in [The `.env` file](../configuration/env.md).

With no collected data, every dashboard route lands on the **`/setup` wizard**. Step 1 opens with the **Conectar com GitHub** button already working, because `.env.example` ships an example Client ID. Without a Client ID, pasting a PAT and the `gh` bridge remain available.

Continue with [The setup wizard](./setup-wizard.md).
