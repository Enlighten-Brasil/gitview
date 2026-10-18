---
title: Quickstart
description: Clone, pnpm install e pnpm dev — sem editar nada à mão — e você chega ao wizard /setup em poucos minutos.
---

# Quickstart

Do clone ao primeiro dashboard em poucos minutos. Você precisa de Node 22.13+, pnpm 11.28 e uma conta GitHub — não há nada para copiar ou editar antes do primeiro run.

## O que eu preciso?

- **Node 22.13+** — os coletores usam `node:sqlite`, sem flag desde a 22.13 (o CI roda Node 22).
- **pnpm 11.28** — pinado no campo `packageManager` do `package.json` (`pnpm@11.28.6`). Rode `corepack enable` uma vez, ou instale o pnpm 11.28 direto.
- **Uma conta GitHub** — a autenticação acontece pela própria UI (device flow ou colar um PAT) ou pela ponte do GitHub CLI (`gh auth login`). Ver [Conectando o GitHub](./connecting-github.md).

## Instale e rode

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev
```

`pnpm start` é alias do `pnpm dev`. Os dois servem o dashboard em `http://localhost:5173`.

## O que acontece no primeiro run?

Nada para copiar ou editar: o `.env` é criado automaticamente a partir do `.env.example` na primeira execução (`pnpm dev`, `pnpm start` ou qualquer coletor). O `.env` guarda a config da máquina (token, org, pasta dos repos) e é gitignored — igual ao `team.local.json`, o cadastro do seu time.

Sem dados coletados, toda rota de dados leva ao **wizard de configuração** (`/setup`): `/setup/github` → `/setup/repos` → `/setup/collect` → `/setup/team`.

## O que eu devo ver?

O wizard abre com o título **Configurar gitview** e o indicador de passo **passo 1 de 3 — conectar o GitHub**. (A UI do dashboard é pt-BR: os labels ficam exatamente como aparecem na tela, em qualquer idioma desta doc.)

O passo 1 oferece três caminhos de autenticação — ver [Conectando o GitHub](./connecting-github.md). Com um `GITVIEW_GITHUB_CLIENT_ID` definido (o `.env.example` já vem com um de exemplo), o botão **Conectar com GitHub** aparece; sem ele, colar um PAT e a ponte do `gh auth login` continuam funcionando.

:::info Por que o .env se cria sozinho?
O repositório não versiona config de máquina — o `.env.example` é o único template. Criar o `.env` no primeiro run faz clone → `pnpm install` → `pnpm dev` funcionar sem editar nada, e nenhum token ou dado pessoal chega ao git. O `pnpm clean` nunca apaga esse arquivo.
:::

## Próximos passos

- [O wizard de configuração](./setup-wizard.md) — o que cada passo faz e como reabrir depois.
- [Conectando o GitHub](./connecting-github.md) — device flow, PAT ou a ponte do `gh`.
- [Repositórios](./repositories.md) — escolher os repos e entender os clones.
