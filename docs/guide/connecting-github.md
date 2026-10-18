---
title: Connecting GitHub
description: "Device flow, pasted PAT or the gh bridge: what to pick, what to do and which credential is truly read-only."
---

# Connecting GitHub

gitview reads the GitHub API and clones your repos, so it needs a token. Three paths connect your account:

| path | needs | where the token lives |
|---|---|---|
| device flow | `GITVIEW_GITHUB_CLIENT_ID` in `.env` | `.env`, written by the dev server |
| pasted PAT | the PAT itself | `.env`, after validation |
| `gh` bridge | a logged-in GitHub CLI | nowhere; reads `gh auth token` |

## Device flow

Click **Conectar com GitHub**, open the verification URL (`github.com/login/device`) and type the code shown. The card becomes **Conectado como @\<login\>**; **cancelar** aborts at any time.

The flow requires `GITVIEW_GITHUB_CLIENT_ID` in `.env`. `.env.example` already ships one that works for experimenting. To use your org's app, register a GitHub App (recommended) or an OAuth App with Device Flow enabled and set the key. A Client ID is public: the device flow has no client secret.

## Pasted PAT

Paste a classic PAT (`ghp_…`) in **Usar um token pessoal (PAT)** and click **conectar**. gitview validates the token against the API before writing it to `.env`; if validation fails, nothing is written. Scope: `repo` (plus `read:org` to import teams). The token stays only in the `.env` on your machine.

## The `gh` bridge

Run `gh auth login` in the terminal and the auth screen captures the session on its own; **verificar novamente** (check again) forces a check. While `GITVIEW_GITHUB_TOKEN` is empty, the collectors use `gh auth token`. The `gh` CLI is optional: nobody needs it installed to collect.

## Which token is really read-only

gitview only reads, but the guarantee changes with the credential:

| credential | can it write? | protection on the clones |
|---|---|---|
| GitHub App (`Iv…`) with *Contents: Read-only* | no, by GitHub permission | none extra |
| OAuth App (`Ov…`) via device flow | yes, `repo` scope | push locked |
| classic PAT | yes, `repo` scope | push locked |
| `gh auth login` | yes, `repo` scope | push locked |

With a `repo` token (read+write), the safety comes from gitview: managed clones get `remote.origin.pushurl=no-push`. Only a read-only GitHub App delivers the real permission guarantee.

## Switching accounts or disconnecting

- **trocar de conta** (switch account) runs the device flow again and replaces the token in `.env`.
- **desconectar** clears the key from `.env` after confirmation; collection then runs without authentication. If the `gh` bridge exists, it takes over.
- On the `gh` bridge, switch accounts in the terminal (`gh auth login`); the auth screen detects the change on its own.
