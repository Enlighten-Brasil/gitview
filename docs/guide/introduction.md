---
title: Introduction
description: "Read-only git metrics dashboard for any team. Commits, PRs and releases collected on your machine."
---

# Introduction

gitview is a git metrics dashboard for any team. It tracks commits, pull requests (PRs) and releases across your GitHub org's repositories and builds views by dev, by repo and by team: streak, pace, cycle time, off-hours and a weekly summary.

Everything runs on your machine and reads are strictly read-only: nothing is written to the analyzed repos. The collectors read `git log`, `git tag` and the GitHub API, generate JSON in `public/data/`, and the dashboard reads only from those files. The pipeline lives in [Architecture](../architecture/pipeline.md).

- **Local**: `pnpm dev` serves the dashboard at `http://localhost:5173`. Database, clones and JSONs stay on your machine, outside git.
- **Static**: `pnpm build` outputs a site you publish on any static host. The [public demo](https://enlighten-brasil.github.io/gitview/) runs on synthetic data only.
- **MIT**: open source. Roadmap in the issues, contributions in [CONTRIBUTING](https://github.com/Enlighten-Brasil/gitview/blob/main/CONTRIBUTING.md).

Start with the [Quickstart](./quickstart.md).
