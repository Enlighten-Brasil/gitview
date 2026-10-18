---
title: Connecting GitHub
description: The three authentication paths — device flow, pasted PAT and the gh bridge — and which one gives a truly read-only token.
---

# Connecting GitHub

gitview reads the GitHub API (PRs, reviews, releases) and clones your repos, so it needs a token. Three paths connect your account — and they differ in how read-only the resulting token really is.

## What are the three paths?

| path | needs | where the token lands |
|---|---|---|
| device flow | `GITVIEW_GITHUB_CLIENT_ID` in `.env` | `.env` (written by the dev server) |
| PAT pasted in the UI | nothing else | `.env` (validated before saving) |
| `gh auth login` bridge | GitHub CLI (optional) | nowhere — read via `gh auth token` |

### Device flow

Needs `GITVIEW_GITHUB_CLIENT_ID` in the `.env` (the `.env.example` ships with an example Client ID). Click **Conectar com GitHub**: the card shows the verification URL (`github.com/login/device`) and a code — open the URL, type the code, authorize. The token lands in the `.env` and the card switches to **Conectado como @\<login\>**. **cancelar** aborts the polling at any time.

The device flow uses no client secret — never add one to the `.env`. The Client ID is public by design.

### Pasting a PAT

The field **Usar um token pessoal (PAT)** takes a classic PAT (`ghp_…`) and the **conectar** button saves it. gitview validates the token against the GitHub API (`GET /user`) **before** writing anything: a bad token gets a 401 with a message and the `.env` is untouched. Scope, per the UI hint: `repo` (+ `read:org` to import teams). It stays in the `.env` of your machine.

### The `gh auth login` bridge

The GitHub CLI is optional. Run `gh auth login` once in the terminal and the auth screen picks the session up on its own — it polls the dev server every 5s (**verificar novamente** forces a check). While `GITVIEW_GITHUB_TOKEN` is empty, the collectors fall back to `gh auth token`. Nobody needs `gh` installed to collect.

## Which credential is really read-only?

gitview only ever reads, but the guarantee differs per credential:

| credential | permissions | token can write? | mitigation |
|---|---|---|---|
| **GitHub App** (client_id starts `Iv…`) | granular — recommended *Repository → Contents: Read-only* (+ *Metadata*, automatic) | no — physically read-only | none needed |
| **OAuth App** (`Ov…`/hex) | device flow requests `repo read:org` | yes (`repo` is read+write) | `remote.origin.pushurl=no-push` on managed clones |
| **PAT (classic)** | `repo` (+ `read:org`) | yes | same |
| **`gh auth login`** | `repo` | yes | same |

:::info Por que um GitHub App deixa o token fisicamente read-only?
A GitHub App issues tokens that inherit the app's granular permissions: with *Contents: Read-only* the token cannot write to the repos, whatever gitview does. OAuth Apps and `gh auth login` use the classic `repo` scope (read+write) — gitview still only reads, and the managed clones have their push URL locked, but the real permission guarantee comes from the GitHub App.
:::

:::info Por que o Client ID pode ficar no .env.example?
The device flow doesn't use a client secret — the Client ID only identifies the app. Keeping an example one in the template means the **Conectar com GitHub** button works out of the box and nobody has to register their own app to try gitview. For your own org, set `GITVIEW_GITHUB_CLIENT_ID` to your (or your org's) **GitHub App** (recommended, starts with `Iv…`) or **OAuth App** (`Ov…`) with **Device Flow** enabled (GitHub → Settings → Developer settings).
:::

## How do I change accounts or disconnect?

- **trocar de conta** (shown when a Client ID is configured) starts the device flow again and replaces the token in the `.env`.
- **desconectar** (shown for token auth) removes the key from the `.env` after the confirmation **Desconectar a conta do GitHub?** — collection loses authentication until you connect again. If the `gh` bridge exists, it resumes automatically.
- On the `gh` bridge: run `gh auth login` again in the terminal — the change is detected on the auth screen automatically.

## Next steps

- [Repositories](./repositories.md) — what the token is used for when cloning.
- [The setup wizard](./setup-wizard.md) — where these paths sit in the flow.
- [Reference: .env keys](../configuration/env.md) — `GITVIEW_GITHUB_CLIENT_ID` and friends.
