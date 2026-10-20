---
title: Branches page
description: "How the /branches page reads the branch inventory: alert cards, derived statuses, the branch↔PR join and the sortable table."
---

# Branches page

`/branches` is the progress view: the branch inventory collected by `collect-branches` (`branches.json`, full collections only) joined with the pull requests from `github.json`. Formulas for ahead/behind and the collector status live in [Collectors](../architecture/collectors.md); filter scopes per route in [Filter rules](./filters.md). If docs and code disagree, the code wins (`src/branches.ts` + `src/pages/(app)/branches.vue`).

## What the page shows

- **Freshness badge** — `inventário …` (agora mesmo / há Nh / há Nd) from the `generatedAt` of `branches.json`, with the exact timestamp in the tooltip. Light recollections do **not** refresh the inventory, so the badge turns warning-colored after 24h to make the age explicit.
- **Three cards**:
  - **Pousadas — podem ser limpas**: branches with `aheadProd` 0 (collector status `pousada`) or released through a squash-merge (see below), inactive for `GITVIEW_BRANCH_STALE_DAYS`+ days (default 30). Safe-to-delete candidates.
  - **Abandonadas — trabalho não liberado parado**: `aheadProd` > 0, no open PR, inactive for 30+ days, not a bot — work that never reached production and stopped moving. Disjoint from *Pousadas*.
  - **develop × produção**: per-repo mini-list with both deviations of the first integration ref against production: ahead = unreleased work; behind with ahead 0 = abandoned (dead) integration branch. A single global counter would be ambiguous across repos, so the list is per repo.
- **Sortable table** (`.data-table`): branch, repo, status (badge), ahead/behind production, `vs integração` (when the repo has an integration ref), last activity, authors ahead, linked PR and a GitHub link to the branch. Clicking a card filters the table (`só pousadas` / `só abandonadas` chip, removable) and scrolls to it.

The inventory is a *now* snapshot: the period filter does not apply (like open PRs), and the page does not consume the work-scope filter (`?scope=`). Repos, devs and bots filters from the sidebar do apply — the devs filter keeps branches where a selected dev is among the authors ahead; the bots switch controls `bot` branches.

## Statuses

Collector statuses (closed union in `branches.json`): `production` (the production ref), `integration` (an integration ref), `bot` (name matches dependabot/renovate patterns or `GITVIEW_BOT_BRANCHES`), `pousada` (ahead 0 and inactive for 30+ days) and `feature` (everything else).

Two derived statuses are computed in the frontend from the branch↔PR join:

- **viva sem PR** — `feature` branch with `aheadProd` > 0 and no open PR: live work without a pull request. Integration refs with pending work show up in the *develop × produção* card instead; bot branches follow the sidebar switch.
- **pousada via squash** — squash-merges rewrite history, so the branch keeps `aheadProd` > 0 forever even though the work is released. It is only detectable by a MERGED PR with the same repo and `headRef`, plus `headRefOid` equal to the branch tip **or** a `mergedAt` at/after the tip's last activity. The `headRefOid` test avoids false positives when a branch is reused with new commits after the merge.

## Branch↔PR join and partial coverage

The join uses `headRef` (and `headRefOid`) from `github.json`. PRs kept from caches older than those fields do not carry them, so a branch without a match shows **sem vínculo** ("no link") — never "no PR". When part of the PR cache lacks `headRef`, the page shows the badge **vínculo PR↔branch: cobertura parcial (N%)** with the covered fraction; a full GitHub recollection normalizes it. Without `github.json` at all, the linked-PR column degrades to *sem vínculo*, the derived statuses switch off and a warning alert explains why — the page still renders the inventory.

The linked PR shown per branch is the most recent open one; with no open PR, the most recently merged. Authors ahead are raw git e-mails (`%ae` — pure git fact, no recollection needed after alias edits): the page maps e-mail → dev through `team.json#devs[].emails` and falls back to showing the raw e-mail when unmapped.

## Example (demo data)

With the demo fixtures (`demo-api` with a `develop` integration ref, `demo-web` without one): `feat/order-endpoint` (demo-api) shows as `pousada` — ahead 0, 96 behind; `develop` appears in the *develop × produção* card with +4 ahead; `refactor/auth-service` (demo-web) has an open PR (#11), so it is not *viva sem PR*; `chore/deps-update` was deleted after its squash-merge — the `headRef` survives in the PR even though the branch is gone.

## Related

- [Collectors](../architecture/collectors.md) — how `branches.json` is produced (full collections only).
- [Data model](../architecture/data-model.md) — the seven JSON files.
- [Filter rules](./filters.md) — per-route filter scope.
