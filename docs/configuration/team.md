---
title: Team config (team.local.json)
description: "The team.local.json: dev profiles, aliases, teams and bots, plus the /teams screen editor."
---

# Team config (`team.local.json`)

`team.local.json` is the team roster on your machine: canonical names, identity aliases, teams and bots. It is gitignored, plain JSON, edited on the **/teams** screen (dev only) and read on every run. No cleanup ever deletes it.

## Format

```json
{
  "devProfiles": {
    "Ana Souza": {
      "title": "Tech lead",
      "description": "core services, squad plataforma",
      "emails": ["ana@corp.com", "ana.souza@users.noreply.github.com"],
      "githubLogins": ["anasouza"]
    }
  },
  "teams": [
    { "name": "Plataforma", "description": "core services", "color": "#8b5cf6",
      "members": ["Ana Souza", "Bruno Lima"], "renamedFrom": ["Backend"] }
  ],
  "bots": ["meu-bot-interno"],
  "githubBots": ["my-automation-bot"]
}
```

You can edit it by hand, but the UI rewrites the whole file on save. Invalid JSON stops the collectors with `team.local.json inválido: ...`.

## devProfiles

One profile per dev, keyed by the canonical name: that name is what appears on the dashboards and at `/devs/<name>`.

| field | what it does | format |
|---|---|---|
| `title` | role shown on the dev card | string |
| `description` | free note (focus, squad) | string |
| `emails` | this dev's commit e-mails | array |
| `githubLogins` | this dev's GitHub logins | array |

- `emails` + `githubLogins` are the aliases: collection maps each one to the canonical name. Logins are compared case-insensitively.
- Without profiles the dashboard still works, but every e-mail and login becomes a separate author. These candidates show up under **Sem mapeamento** (unmapped).

## teams

| field | what it does | format |
|---|---|---|
| `name` | team name, also the URL `/teams/<name>` | string |
| `description` | note under the title | string |
| `members` | canonical dev names | array |
| `color` | badge color | optional hex |
| `renamedFrom` | previous team names | array written by the UI |

Renaming in the editor adds the old name to `renamedFrom`, and `/teams/<old-name>` then redirects.

## bots and githubBots

- `bots`: git author names counted as bots, on top of those ending in `[bot]`.
- `githubBots`: logins added to the built-in list: `dependabot`, `copilot-pull-request-reviewer`, `copilot-swe-agent`, `cursor`, `github-code-quality`.
- Covered automatically, no entry needed: logins with `[bot]`, ending in `-bot` or starting with `dependabot`.
- Bots stay out of the dev lists, the team lists and the candidates.

## The /teams screen

Dev server only. In the static build the page renders from `team.json` and is read-only.

- **Times** (teams) and **Devs**: the team card edits name, description, color and members. **editar perfil** (edit profile) opens a modal with title, description, e-mails and logins (comma-separated lists).
- **Sem mapeamento** (unmapped): identities in the data with no alias; pick the dev in **associar a…** (associate with) and confirm. **importar do GitHub** (import from GitHub) brings teams and members from the org (token with `read:org`) as a draft, written only when you save.
- Save bar: **desfazer** (undo), **salvar** (save), **salvar + recoletar** (save + re-collect).

## When a change takes effect

- **salvar** regenerates `team.json` on the spot: names, colors, members and `renamedFrom` apply right away.
- **Aliases** touch `stats.json`: they take effect only after a re-aggregation. That is why **salvar + recoletar** exists, no git re-scan, see [Collectors](../architecture/collectors.md).
- **Removing an alias** does not rename rows already written to the database. Only `pnpm clean && pnpm collect` rebuilds those, see [Data maintenance](./maintenance.md).

## Next steps

- [The .env file](./env.md): machine config and the `GITVIEW_*` keys.
- [The setup wizard](../guide/setup-wizard.md): step 4, identity unification.
