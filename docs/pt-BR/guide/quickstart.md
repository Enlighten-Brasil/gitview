---
title: Quickstart
description: "Do clone ao primeiro dashboard: pnpm install, pnpm dev e o wizard de configuração. Nada para editar antes."
---

# Quickstart

## Pré-requisitos

- **Node 22.13+**: necessário pelo `node:sqlite` dos coletores.
- **pnpm 11.28**: pinado no campo `packageManager` do `package.json`. Rode `corepack enable` uma vez, ou instale o pnpm 11.28.
- **Uma conta GitHub**: a autenticação acontece na UI (device flow ou PAT) ou pela ponte do `gh auth login`. Veja [Conectando o GitHub](./connecting-github.md).

## Instale e rode

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev
```

`pnpm start` é alias do `pnpm dev`. Os dois servem o dashboard em `http://localhost:5173`.

## Primeiro run

Nada para copiar ou editar antes: o `.env` é criado automaticamente a partir do `.env.example` na primeira execução. As chaves da máquina estão em [O arquivo `.env`](../configuration/env.md).

Sem dados coletados, toda rota do dashboard cai no **wizard `/setup`**. O passo 1 abre com o botão **Conectar com GitHub** funcionando, porque o `.env.example` já traz um Client ID de exemplo. Sem Client ID, colar um PAT ou a ponte do `gh` continuam disponíveis.

Continue em [O wizard de configuração](./setup-wizard.md).
