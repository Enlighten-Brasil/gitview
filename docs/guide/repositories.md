---
title: Repositories
description: "Choosing the dashboard's repositories, how managed clones stay fresh and how to use clones you already have."
---

# Repositories

gitview reads repositories from one folder, `data/repos/` by default. The wizard fills the folder with managed clones, or you point `GITVIEW_REPOS_ROOT` at clones that already exist.

## Choosing the repositories

The step-2 picker (`/setup/repos`) and the one under Settings → **gerenciar repositórios** (manage repositories) list repos through the GitHub API:

- **organização**: your orgs, plus the `<login> (pessoal)` entry with your personal repos;
- **buscar repositórios**: filters the list as you type;
- pre-selection: the CSV in `GITVIEW_DEFAULT_REPOS`; empty = all non-archived. Shortcuts **padrão do time** (team default), **todos** (all), **nenhum** (none);
- badges: **arquivado** (archived; not selectable) and **atual** (current; already in the dashboard, when managing).

Only the missing repos are cloned, in parallel. In manage mode, unchecking a current repo deletes its clone from disk after the confirmation **Apagar repositórios do disco?** (Delete repositories from disk?) → **apagar e aplicar** (delete and apply). Removal is always explicit: gitview never prunes clones just because they left the list.

## What managed clones are

The setup clones each repo as a bare clone (no working tree) in `data/repos/` and writes `GITVIEW_REPOS_ROOT=data/repos` to `.env`. After that:

- every collection starts with `git fetch --all --prune --tags` on each managed clone; a failed fetch falls back to the local cache with a warning;
- the token is injected only into the git process environment, never on the command line or in the clone's config;
- each clone gets `remote.origin.pushurl=no-push`: pushing is impossible at the git level.

## Pointing at clones you already have

Set `GITVIEW_REPOS_ROOT` to the folder that holds the repos, one per subfolder. Normal checkouts and bare clones both work. Value precedence and path formats are in [The `.env` file](../configuration/env.md).

In this mode the numbers reflect the state of your local clones: run `git pull` in the repos before collecting to get fresh data. The freshness badge in the navbar shows when the collection ran.
