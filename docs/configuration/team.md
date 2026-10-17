---
title: Team config (team.local.json)
description: Dev profiles, aliases, teams and bots — the /teams editor, GitHub import, unmapped candidates and per-team dashboards.
---

# Team config (`team.local.json`)

`team.local.json` is the team registry that lives on your machine: dev profiles, identity aliases, teams and bots. It is gitignored, it is the single source of canonical names — and no cleanup ever deletes it. Everything is editable on the **/teams** screen (dev only; persisted through `POST /__team/config`).

## What lives in the file

The file is plain JSON written by the `/teams` editor. Shape:

```json
{
  "devProfiles": {
    "Ana Souza": {
      "title": "Tech lead",
      "description": "foco, squad, observações…",
      "emails": ["ana@corp.com", "ana.souza@users.noreply.github.com"],
      "githubLogins": ["anasouza"]
    }
  },
  "teams": [
    {
      "name": "Plataforma",
      "description": "core services",
      "color": "#8b5cf6",
      "members": ["Ana Souza", "Bruno Lima"],
      "renamedFrom": ["Backend"]
    }
  ],
  "bots": ["meu-bot-interno"],
  "githubBots": ["my-automation-bot"]
}
```

### devProfiles — dev profiles and aliases

Keyed by the canonical dev name.

| field | what it does | format |
|---|---|---|
| `title` | Role/cargo shown on the dev card (UI field **título / cargo**) | string |
| `description` | Free note — focus, squad, observations | string |
| `emails` | Commit e-mails that map to this dev (aliases in git) | array of e-mails |
| `githubLogins` | GitHub logins that map to this dev (matched case-insensitively) | array of logins |

Without profiles the dashboard still works — every e-mail/login becomes its own author and the collector lists the [candidates](#sem-mapeamento) for you to link up.

### teams — teams

| field | what it does | format |
|---|---|---|
| `name` | Team name; also the dashboard URL `/teams/<name>` | string |
| `description` | Free note shown under the title | string |
| `color` | Badge color (optional) — the editor offers a 10-color palette, a custom value and **sem cor** | hex (`#8b5cf6`) |
| `members` | Canonical dev names | array |
| `renamedFrom` | Previous names after a rename on `/teams` — keeps old links alive | array |

### bots and githubBots

- `bots` — extra canonical git author names treated as bots (on top of the built-in rule: names ending in `[bot]`).
- `githubBots` — extra GitHub logins added to the built-in list (`dependabot`, `copilot-pull-request-reviewer`, `copilot-swe-agent`, `cursor`, `github-code-quality`); login patterns ending in `-bot` or starting with `dependabot` are detected automatically.

Bots are excluded from dev lists and candidates — they never show up as team members.

## The /teams screen

Route `/teams` (alias `/team`), dev only — in the [static build](https://github.com/Enlighten-Brasil/gitview/blob/main/README.md#publishing-the-dashboard-static-build) the page is read-only and renders from `team.json`. Three sections, mirrored in the side rail: **Times**, **Devs**, **Sem mapeamento**.

**Team cards** edit name (placeholder `Nome do time`), description (`descrição (opcional)`), color (popover with the palette, **cor personalizada** as `#hex`, and **sem cor**), and members (removable chips plus a searchable combobox `adicionar membro… (busca por nome)`; the hint flags devs already on another team). Each card shows aggregated metrics (devs, commits, PRs, last commit) and an **abrir dashboard do time** link. **novo time** adds a card; removing a team asks for confirmation in a modal (**Remover o time "X"?**).

**Dev cards** show the avatar, colored team badges and the alias count (details in the tooltip). The edit button opens the profile modal (**perfil de \<nome\>**) with **título / cargo**, **descrição**, **e-mails de commit** and **logins do GitHub** (comma-separated lists), applied with **aplicar**.

### Sticky save bar

The bar at the bottom tracks unsaved changes (`alterações não salvas (só nesta máquina até salvar)` / `tudo salvo em team.local.json`) with three actions:

- **desfazer** — reverts to the last saved snapshot (confirmation: "Descartar alterações?").
- **salvar** — persists to `team.local.json` and regenerates `team.json` right away.
- **salvar + recoletar** — saves, then runs the light re-collection (`/__collect?light=1`: re-aggregates with the new aliases, without re-scanning git).

### Importing from GitHub

The **importar do GitHub** button opens a slideover fed by `GET /__team/github`: org members and teams via the REST API. It requires a token with `read:org`; partial failures (e.g. missing permission → empty teams) come back as `warnings` shown in the modal. **importar** adds each team as a draft, resolving logins to devs through the aliases already mapped — imported members land as a count like `3/5 membros mapeados — revise e salve`. Nothing is persisted until you save.

### Sem mapeamento

The **Sem mapeamento** section lists the identities seen in the data without a registered alias (`team.json#candidates`): git authors (with their e-mails) and GitHub logins (with their PR/review counts). Pick a dev in `associar a… (busca por nome)` and confirm with **associar** to attach the identity to that profile.

Candidates with a corporate e-mail get a **sugestão** badge: the suggestion crosses the e-mail local-part tokens with the dev's name tokens (accents stripped, ≥2 tokens matching and a match ratio ≥ 0.5). It only pre-selects the dropdown — the button becomes **confirmar**, but the association is always a manual click.

:::info Why is team.local.json never deleted?
It is the only non-regenerable piece of the dataset: the database and JSONs can be rebuilt from the repositories, but your roster of canonical names, aliases and teams exists nowhere else. `pnpm clean`, **limpar e recoletar** and **apagar dados** all skip it on purpose — losing it would silently split every dev back into per-e-mail authors.
:::

:::info Why do aliases need a re-collection?
Identity resolution happens at collection time: the collected commits store the canonical name already resolved, in `stats.json`. Saving regenerates `team.json` (names, colors, members and `renamedFrom` apply immediately), but the aliases themselves only take effect when the data is re-aggregated — that is what **salvar + recoletar** is for. Removing an alias does not revert names already recorded in the database; only a full `pnpm clean && pnpm collect` rebuilds them.
:::

## Team dashboards (/teams/\<name\>)

Every team gets a shareable dashboard at `/teams/<name>`: KPI cards, commit timeline, heatmap, commit types, PR summary, open PRs, cycle time and off-hours — with the devs **locked to the team members**. Period and repos stay filterable; the URL path is the sharing context.

- **Renamed teams keep old links alive**: names are recorded in `renamedFrom` on save, and `/teams/<old-name>` redirects to the current one.
- **ver como filtro livre** opens the main dashboard with `?devs=<members>` as an editable dev filter — leave the team scope and tweak the selection.
- A wrong name shows **Time não encontrado** with up to five team suggestions.

## Next steps

- [The .env file](./env.md) — machine config and the `GITVIEW_*` keys.
- [Data maintenance](./maintenance.md) — when a full clean + collect is what fixes the numbers.
