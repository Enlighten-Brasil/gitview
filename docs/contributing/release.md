---
title: Release ritual
description: "From changeset to the single chore(release) commit: what CI requires, how to propose changes, doc parity."
---

# Release ritual

Every change takes the same path: one changeset, pt-BR work commits, the version bump, the gates, and a single `chore(release): X.Y.Z` commit. Before your first PR, see [Development setup](./development.md).

## The five steps

1. **Record the change** with `pnpm changeset` (`minor` = feature, `patch` = fix), committed alongside the code. A code PR without a changeset comes back in review.
2. **Work commits** in pt-BR, Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`). A commit that closes a roadmap issue ends its body with `Ref: #N`.
3. **Apply the version** with `pnpm version:packages`: bumps `package.json` and writes the `CHANGELOG.md` entry. There is no `version` script, so never bump with a bare `pnpm version` or `npm version`.
4. **Run the gates**: `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, plus `pnpm check:data` when you touched collectors or data shapes.
5. **Release commit**: a single `chore(release): X.Y.Z` commit with the bump and the changelog. The current version lives in `package.json`, the history in `CHANGELOG.md`.

Contributors own steps 1 and 2. The maintainer applies steps 3 to 5. The rest is review.

## What CI requires

Two jobs in `.github/workflows/ci.yml`, triggered on every PR and on push to `main`:

| Job | Steps |
|---|---|
| `gates` | `pnpm install --frozen-lockfile`, `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build` |
| `docs` | `pnpm check:docs` (EN and pt-BR parity) and `pnpm docs:build` (a dead link fails the build) |

Node 22, pnpm from the `packageManager` field, actions pinned by SHA. `check:data` stays out of CI: it validates `public/data/`, which is gitignored and only exists after a local collection with a token.

`.github/workflows/pages.yml` builds and deploys the public demo from the synthetic fixture, with the docs in the same artifact. Details in [Publishing the static build](../guide/publishing.md).

## Roadmap and proposals

The roadmap lives in [GitHub issues](https://github.com/Enlighten-Brasil/gitview/issues) and milestones; [`ROADMAP.md`](https://github.com/Enlighten-Brasil/gitview/blob/main/ROADMAP.md) only points there. What is not in an issue is not planned.

To propose a change, open an issue with three blocks:

- **Context**: the situation that motivates the change and what hurts today.
- **Proposal**: the desired behavior, not the implementation detail.
- **Criterion**: what must be true to consider it done.

For a bug, the recipe is simpler: what you did, what you expected, what happened. The collectors' output and the `pnpm check:data` warnings pin the bug down faster. The tool is read-only over the analyzed repos: a proposal to write to them is outside the project's line.

## Doc parity

`README.md` is the primary document and `README.pt-BR.md` is the section-by-section mirror; the same rule applies to `CONTRIBUTING.md` / `CONTRIBUTING.pt-BR.md` and to every page in `docs/` with its pair in `docs/pt-BR/`. Every doc change updates both files in the same PR, and `pnpm check:docs` enforces the pair. Every cited command or label must exist in `package.json` or in the code.

Changed a UI label, a command, a `GITVIEW_*` key, a `team.local.json` field or a metric rule? Update every page that cites it in the same PR and regenerate the affected screenshots with `pnpm.cmd demo:shots`. A docs page deepens the README, it does not rewrite it.
