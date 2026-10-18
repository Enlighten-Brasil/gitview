---
title: Repositories
description: Pick the repos that enter the dashboard, how managed clones stay fresh, and how to point gitview at clones you already have.
---

# Repositories

gitview reads the repos from one folder — `data/repos/` by default. The wizard can fill it for you (managed clones), or you point `GITVIEW_REPOS_ROOT` at clones you already have.

## How do I choose the repositories?

Step 2 of the wizard (**escolher repositórios**, route `/setup/repos`) — or later via Settings → **gerenciar repositórios**. The picker lists the repos from the GitHub API:

- **organização** — your orgs, plus a `<login> (pessoal)` entry that lists your personal repos;
- **buscar repositórios** — filters the list as you type;
- pre-selection — the repos in `GITVIEW_DEFAULT_REPOS` (CSV in `.env`); with the CSV empty, all non-archived repos come pre-selected. **padrão do time** re-applies the CSV, **todos** selects every non-archived repo, **nenhum** clears the selection;
- badges — **arquivado** on archived repos (can't be selected) and **atual** on repos already in the dashboard when managing.

Only the missing repos are cloned, in parallel (pool of 4). In manage mode, unchecking a current repo warns **N repo(s) serão removidos do disco: \<names\>** and the apply (**aplicar mudanças**) deletes the clone after the confirmation **Apagar repositórios do disco?** → **apagar e aplicar**. Removal is always explicit — gitview never prunes clones just because they fell out of a list.

## What are managed clones?

The setup clones each repo as a bare clone in `data/repos/` (gitignored) and writes `GITVIEW_REPOS_ROOT=data/repos` to the `.env`. From then on the clones are maintained for you:

- every collection starts with `git fetch --all --prune --tags` on each managed clone (a failed fetch falls back to the local cache with a warning);
- the token is injected only through the git process environment (`GIT_CONFIG_COUNT/KEY/VALUE`, Basic `x-access-token`) — never in the command line, never written into the clone's config;
- each clone gets `remote.origin.pushurl=no-push` (idempotent, re-applied on every collection), so git cannot push even if something tries.

:::info Por que a URL de push fica travada?
OAuth Apps and `gh auth login` hand out `repo`-scoped tokens, which are read+write. gitview only reads — but rather than trusting the code path alone, managed clones lock the push URL at the git level. The real permission guarantee still comes from a GitHub App with *Contents: Read-only* (see [Connecting GitHub](./connecting-github.md)).
:::

## How do I point gitview at clones I already have?

Set `GITVIEW_REPOS_ROOT` to the folder holding them — one repo per subfolder, normal checkouts and bare repos both work. The collectors resolve the folder in this order:

1. `GITVIEW_REPOS_ROOT` environment variable (shell)
2. `GITVIEW_REPOS_ROOT` in the `.env`
3. default: `data/repos` (the managed clones)

Relative paths resolve from the project root. On Windows, forward slashes work fine (`C:/dev/repos/api`) — or single quotes if the path contains spaces.

## What do I do when the numbers change?

With managed clones: nothing — the fetch runs at the start of every collection.

With clones you manage yourself: the data reflects the state of your local clones. `git pull` the repos before collecting if you want fresh numbers. When totals look stale, the navbar badge tells you how fresh the data is.

## Next steps

- [The setup wizard](./setup-wizard.md) — where the picker lives in the flow.
- [Connecting GitHub](./connecting-github.md) — what the token is used for.
- [Reference: metrics](../dashboard/metrics.md) — what the collectors count.
