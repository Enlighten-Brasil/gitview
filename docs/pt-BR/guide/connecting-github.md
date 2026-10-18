---
title: Conectando o GitHub
description: Os três caminhos de autenticação — device flow, PAT colado e a ponte do gh — e qual dá um token realmente read-only.
---

# Conectando o GitHub

O gitview lê a API do GitHub (PRs, reviews, releases) e clona seus repos, então precisa de um token. Três caminhos conectam sua conta — e eles diferem em quão read-only é o token resultante.

## Quais são os três caminhos?

| caminho | precisa de | onde o token cai |
|---|---|---|
| device flow | `GITVIEW_GITHUB_CLIENT_ID` no `.env` | `.env` (gravado pelo dev server) |
| PAT colado na UI | nada mais | `.env` (validado antes de gravar) |
| ponte do `gh auth login` | GitHub CLI (opcional) | em lugar nenhum — lido via `gh auth token` |

### Device flow

Precisa de `GITVIEW_GITHUB_CLIENT_ID` no `.env` (o `.env.example` já vem com um Client ID de exemplo). Clique em **Conectar com GitHub**: o card mostra a URL de verificação (`github.com/login/device`) e um código — abra a URL, digite o código, autorize. O token cai no `.env` e o card vira **Conectado como @\<login\>**. **cancelar** aborta o polling a qualquer momento.

O device flow não usa client secret — nunca coloque um no `.env`. O Client ID é público por design.

### Colar um PAT

O campo **Usar um token pessoal (PAT)** aceita um PAT clássico (`ghp_…`) e o botão **conectar** grava. O gitview valida o token na API do GitHub (`GET /user`) **antes** de escrever qualquer coisa: token ruim recebe um 401 com mensagem e o `.env` fica intacto. Escopo, pela dica da UI: `repo` (+ `read:org` para importar times). Ele fica só no `.env` da sua máquina.

### A ponte do `gh auth login`

O GitHub CLI é opcional. Rode `gh auth login` uma vez no terminal e a tela de auth captura a sessão sozinha — ela sonda o dev server a cada 5s (**verificar novamente** força a checagem). Enquanto `GITVIEW_GITHUB_TOKEN` estiver vazio, os coletores usam o fallback `gh auth token`. Ninguém precisa do `gh` instalado para coletar.

## Qual credencial é realmente read-only?

O gitview só faz leituras, mas a garantia difere por credencial:

| credencial | permissões | o token escreve? | mitigação |
|---|---|---|---|
| **GitHub App** (client_id começa com `Iv…`) | granular — recomendado *Repository → Contents: Read-only* (+ *Metadata*, automática) | não — fisicamente read-only | nenhuma necessária |
| **OAuth App** (`Ov…`/hex) | o device flow pede `repo read:org` | sim (`repo` é read+write) | `remote.origin.pushurl=no-push` nos clones gerenciados |
| **PAT (clássico)** | `repo` (+ `read:org`) | sim | idem |
| **`gh auth login`** | `repo` | sim | idem |

:::info Por que um GitHub App deixa o token fisicamente read-only?
Um GitHub App emite tokens que herdam as permissões granulares do app: com *Contents: Read-only* o token não consegue escrever nos repos, faça o gitview o que fizer. OAuth Apps e `gh auth login` usam o escopo clássico `repo` (read+write) — o gitview continua só lendo, e os clones gerenciados têm a URL de push travada, mas a garantia de permissão real vem do GitHub App.
:::

:::info Por que o Client ID pode ficar no .env.example?
O device flow não usa client secret — o Client ID só identifica o app. Deixar um de exemplo no template faz o botão **Conectar com GitHub** funcionar sem configuração e ninguém precisa registrar o próprio app para experimentar o gitview. Para a sua org, defina `GITVIEW_GITHUB_CLIENT_ID` com o Client ID do **GitHub App** (recomendado, começa com `Iv…`) ou **OAuth App** (`Ov…`) da sua org com **Device Flow** habilitado (GitHub → Settings → Developer settings).
:::

## Como trocar de conta ou desconectar?

- **trocar de conta** (aparece quando há Client ID configurado) inicia o device flow de novo e substitui o token no `.env`.
- **desconectar** (aparece na autenticação por token) remove a chave do `.env` após a confirmação **Desconectar a conta do GitHub?** — a coleta fica sem autenticação até conectar de novo. Se existir a ponte do `gh`, ela reassume automaticamente.
- Na ponte do `gh`: rode `gh auth login` de novo no terminal — a troca é detectada na tela de auth automaticamente.

## Próximos passos

- [Repositórios](./repositories.md) — para que serve o token na hora de clonar.
- [O wizard de configuração](./setup-wizard.md) — onde esses caminhos ficam no fluxo.
- [Referência: chaves do .env](../configuration/env.md) — `GITVIEW_GITHUB_CLIENT_ID` e companhia.
