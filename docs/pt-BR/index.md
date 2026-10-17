---
layout: home
title: gitview
description: "Métricas de time para gerentes de desenvolvimento — commits, PRs e releases da sua org do GitHub, coletados localmente, read-only."
hero:
  name: gitview
  text: Métricas de time para gerentes de desenvolvimento
  tagline: Commits, PRs e releases da sua org do GitHub — coletados na sua máquina, estritamente read-only.
  image:
    src: /logo.svg
    alt: Logo do gitview
  actions:
    - theme: brand
      text: Começar
      link: /pt-BR/guide/quickstart
    - theme: alt
      text: Ver demo
      link: https://enlighten-brasil.github.io/gitview/
    - theme: alt
      text: GitHub
      link: https://github.com/Enlighten-Brasil/gitview
features:
  - title: Read-only de verdade
    details: "O gitview nunca escreve nos repositórios que analisa. Com um GitHub App read-only o token emitido é fisicamente incapaz de escrever, e os clones gerenciados têm a URL de push travada (`remote.origin.pushurl=no-push`)."
  - title: Roda local, dados seus
    details: "Os coletores gravam SQLite e JSON na sua máquina; `.env` e `team.local.json` são gitignored. As únicas chamadas de rede vão para o GitHub — API e git — durante o setup e a coleta."
  - title: Filtros e métricas de gestão
    details: "Streak, ritmo, cycle time, fora do horário e resumo semanal — com filtros de período, repositório, dev, time e bots."
  - title: Times e identidades
    details: "Una e-mails de commit e logins do GitHub em perfis de dev; cada time ganha o seu dashboard em `/teams/<nome>`."
  - title: 100% estático
    details: "O `pnpm build` gera um `dist/` que você publica em qualquer host estático — a demo ao vivo é exatamente esse build."
  - title: Open source MIT
    details: "Licença MIT. O que vem a seguir vive nas issues e milestones do GitHub; como ajudar está no `CONTRIBUTING.md`."
---

## Como funciona

Três passos, sem servidor para configurar no meio do caminho:

1. **Conectar o GitHub** — device flow no browser, colar um PAT ou a ponte do `gh` CLI. Na primeira execução você cai no wizard `/setup`; não há nada para editar antes.
2. **Coletar** — os coletores rodam `git log` para dentro de um SQLite e exportam JSON em `public/data/`; PRs e reviews vêm da API do GitHub, e as releases combinam tags locais com a API. A recoleta é incremental (o ↻ da navbar).
3. **Navegar o dashboard** — commits, PRs, releases, streak, cycle time e fora do horário, com filtros de período, repositórios, devs e times.

O pipeline completo (git → SQLite → `public/data/*.json` → frontend estático) está documentado em [Arquitetura](./architecture/pipeline.md).
