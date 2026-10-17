---
layout: home
title: gitview
hero:
  name: gitview
  text: Git & GitHub metrics dashboard
  tagline: Open-source dashboard that turns git history and GitHub activity into actionable team metrics.
  image:
    src: /logo.svg
    alt: gitview logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/Enlighten-Brasil/gitview
features:
  - icon: 📊
    title: Metrics that matter
    details: Commits, pull requests, reviews and releases per person, team and repository — all in one place.
  - icon: 🔌
    title: GitHub integration
    details: Incremental collectors pull activity through the GitHub API with a personal access token.
  - icon: 🎛️
    title: Filters and drill-down
    details: Slice every chart by period, repository or team member to answer real questions.
  - icon: 👥
    title: Team-aware
    details: Map people to teams and aliases so the metrics reflect how your org actually works.
  - icon: 📦
    title: Static publishing
    details: Data lives in JSON files — publish the dashboard to GitHub Pages or any static host.
  - icon: 🔒
    title: Local-first
    details: Everything runs on your machine or CI; your data never leaves your environment.
---

## How it works

1. **Collect** — the collectors pull git history and GitHub activity into local JSON files.
2. **Build** — the Vite app renders the dashboard from the collected data, no backend required.
3. **Publish** — deploy the static output to GitHub Pages (like the [live demo](https://enlighten-brasil.github.io/gitview/)) or any static host.
