---
title: Introdução
description: O que o gitview é, o que não é e como a doc está organizada — um dashboard read-only de métricas de time para orgs do GitHub.
---

# Introdução

gitview é um dashboard de métricas de time para gerentes de desenvolvimento: ele acompanha commits, pull requests (PRs) e releases nos repositórios da org do GitHub. Tudo roda local e é estritamente read-only sobre os repos analisados.

## O que o gitview é

Aponte os coletores para os seus repositórios e o gitview transforma `git log`, API do GitHub e `git tag` em um dashboard: commits por dev e por repo, fluxo de PRs e reviews, releases com as notas, além de visões derivadas como streak e cycle time. O pipeline grava JSON em `public/data/` e o frontend lê de lá — detalhes em [Arquitetura](../architecture/pipeline.md).

O projeto é MIT e não versiona dado de máquina nem de time. Existe uma demo pública rodando apenas com dados sintéticos (nenhum dado real de time): https://enlighten-brasil.github.io/gitview/

## Características centrais

- **Roda local** — `pnpm dev` serve o dashboard em `http://localhost:5173`. Banco, clones e JSONs vivem na sua máquina (gitignored).
- **Estritamente read-only** — o gitview nunca escreve nos repositórios analisados. As únicas escritas são nos arquivos locais dele: `.env`, `team.local.json`, `data/` e `public/data/`.
- **Frontend 100% estático** — `pnpm build` gera um `dist/` estático servível em qualquer host estático. O navegador só lê os JSONs de `public/data/`; nada é recalculado do git no navegador.
- **Licença MIT** — use, faça fork, adapte. O [CONTRIBUTING.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CONTRIBUTING.pt-BR.md) explica como mandar mudanças de volta.

## O que o gitview não é

- **Não é CI.** Nada dos seus builds, testes ou deploys passa pelo gitview — ele lê o histórico do git e a API do GitHub, e só isso.
- **Não escreve nos seus repos.** Sem comentários, sem labels, sem push. Os clones gerenciados têm até a URL de push travada (`remote.origin.pushurl=no-push`).
- **Não substitui gestão.** O dashboard mostra tendências para suas 1:1s e conversas de planejamento rodarem sobre números, não sobre memória. O julgamento continua sendo seu.

## Status do projeto

O pipeline completo funciona de ponta a ponta: os coletores rodam `git log` para dentro de um SQLite e exportam JSON em `public/data/`, PRs e reviews vêm da API do GitHub, releases combinam as tags `git tag` locais com a API, e o frontend é um build 100% estático que publica em qualquer host estático — a demo acima é exatamente esse build. O CI roda os gates em todo PR (`pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build`), e toda release sai com changeset e um commit único `chore(release)` (histórico no [CHANGELOG.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CHANGELOG.md)).

O que vem a seguir vive nas issues e milestones do GitHub — ver [ROADMAP.md](https://github.com/Enlighten-Brasil/gitview/blob/main/ROADMAP.md). Como ajudar está no [CONTRIBUTING.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CONTRIBUTING.pt-BR.md).

## Como esta documentação está organizada

- **Primeiros passos** (`guide/`) — esta seção: instalar, configurar e entender onde tudo vai parar.
- **Referência** — as chaves do `.env`, as regras de métrica e filtro, o modelo de dados ([configuration/env.md](../configuration/env.md), [dashboard/metrics.md](../dashboard/metrics.md), [architecture/data-model.md](../architecture/data-model.md)).
- **Arquitetura** — como coletores e build estático se encaixam (`architecture/pipeline.md`).
- **No repositório** — o [README](https://github.com/Enlighten-Brasil/gitview/blob/main/README.pt-BR.md) cobre setup e comandos; o `AGENTS.md` tem o mapa de arquitetura, as regras dos filtros e as convenções.

## Próximos passos

- [Quickstart](../guide/quickstart.md) — instalar e chegar ao dashboard.
- [O wizard de configuração](../guide/setup-wizard.md) — o que cada passo de `/setup` faz.
- [Conectando o GitHub](../guide/connecting-github.md) — escolher um caminho de autenticação.
