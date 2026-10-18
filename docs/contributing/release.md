---
title: Release ritual
description: From changeset to the single chore(release) commit — plus what CI enforces, where the roadmap lives and the doc parity rule.
---

# Release ritual

Every change to gitview travels the same road: a changeset, pt-BR work commits, the version bump, the gates, and one `chore(release): X.Y.Z` commit. This page is the map — follow it and review stays boring.

## How does a release happen?

Five steps, in order:

1. **Record the change** — `pnpm changeset` (`minor` = feature, `patch` = fix), committed alongside the code. A PR with code changes and no changeset comes back in review.
2. **Work commit(s)** — messages in pt-BR, Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, …). Commits that close roadmap issues end their body with `Ref: #N`.
3. **Apply the version** — `pnpm version:packages`: bumps the version in `package.json` and writes the entry in `CHANGELOG.md`. There is no `version` script in `package.json` — never bump with a bare `pnpm version`/`npm version`.
4. **Run the gates** — `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build` (add `pnpm check:data` when you touched collectors or data shapes).
5. **Release commit** — a single `chore(release): X.Y.Z` commit holding the bump and the changelog. The current version lives in `package.json`; the history lives in `CHANGELOG.md`.

The maintainer applies steps 3–5; contributors own steps 1–2. Everything else is review.

## What does CI enforce?

Two workflows, two jobs:

- **`.github/workflows/ci.yml`** ("CI") — runs on every PR and on pushes to `main`: `pnpm install --frozen-lockfile`, then `pnpm check:scrub` (identity-scrub anti-regression, [issue #17](https://github.com/Enlighten-Brasil/gitview/issues/17)), `pnpm lint`, `pnpm typecheck`, `pnpm build`. Node 22, pnpm from the `packageManager` field, actions pinned by SHA (supply-chain hygiene on a public repo). `check:data` stays out on purpose — it validates `public/data/`, which only exists after a local collection.
- **`.github/workflows/pages.yml`** ("Deploy demo") — builds and deploys the public demo to GitHub Pages from a synthetic fixture. Details in [Publishing the static build](../publishing/static-deploy.md).

If CI is green and the gates pass locally, the change is releasable.

## Where is the roadmap?

In [GitHub Issues](https://github.com/Enlighten-Brasil/gitview/issues) and milestones — whatever is not in an issue is not planned. [`ROADMAP.md`](https://github.com/Enlighten-Brasil/gitview/blob/main/ROADMAP.md) is intentionally tiny: no checklists, no status, no duplicated rules. To see what is next, open the current milestone.

:::info Why is ROADMAP.md so small?
Because a roadmap written in markdown rots: stale checklists, duplicated status, rules nobody syncs. The GitHub tracker — issues and milestones — is already the source of truth, so `ROADMAP.md` just points there and never needs maintenance. Whatever is not in an issue is not planned.
:::

## How do I propose a change?

Open a [GitHub issue](https://github.com/Enlighten-Brasil/gitview/issues) with three sections:

- **Contexto** — what situation motivates the change; what hurts today.
- **Proposta** — what you want to change, at the level of behavior (not implementation detail).
- **Critério** — what must be true to consider it done.

For bugs, the recipe is simpler: what you did, what you expected, what happened — collector output and `pnpm check:data` warnings pin bugs down much faster. Keep in mind the tool is read-only over the analyzed repos; proposals to write to them are outside the project's line.

## Why do the docs ship in pairs?

`README.md` (English) is the primary document and `README.pt-BR.md` is a section-by-section mirror — the same rule applies to `CONTRIBUTING.md` / `CONTRIBUTING.pt-BR.md`. Any documentation change updates **both** files of the pair in the **same** change, and every command or label you cite must exist in `package.json` / the components. There is no "translate later" step: an unpaired doc change does not land.

:::info Why do docs and README ship in pairs?
The project is Brazilian in maintenance and open-source in distribution: the team works in pt-BR, the community reads English. Instead of picking one language and cutting half the audience out, every document gets a pair — `X.md` (primary, English) and `X.pt-BR.md` (section-by-section mirror). The "same change, both files" rule is what keeps the mirror from becoming abandoned translation.
:::

## Next steps

- [Development setup](./development.md) — commands, gates and conventions in detail.
- [Publishing the static build](../publishing/static-deploy.md) — how releases become a live dashboard.
- [CHANGELOG.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CHANGELOG.md) — the release history.
