---
title: Conectando o GitHub
description: "Device flow, PAT colado ou ponte do gh: o que escolher, o que fazer e qual credencial é realmente read-only."
---

# Conectando o GitHub

O gitview lê a API do GitHub e clona seus repos, então precisa de um token. Três caminhos conectam sua conta:

| caminho | precisa de | onde o token fica |
|---|---|---|
| device flow | `GITVIEW_GITHUB_CLIENT_ID` no `.env` | `.env`, gravado pelo dev server |
| PAT colado | o próprio PAT | `.env`, após validação |
| ponte do `gh` | GitHub CLI logado | em lugar nenhum; lê `gh auth token` |

## Device flow

Clique em **Conectar com GitHub**, abra a URL de verificação (`github.com/login/device`) e digite o código exibido. O card vira **Conectado como @\<login\>**; **cancelar** aborta a qualquer momento.

O fluxo exige `GITVIEW_GITHUB_CLIENT_ID` no `.env`. O `.env.example` já traz um que funciona para experimentar. Para usar um app da sua org, registre um GitHub App (recomendado) ou OAuth App com Device Flow habilitado e preencha a chave. Client ID é público: o device flow não tem client secret.

## PAT colado

Cole um PAT clássico (`ghp_…`) em **Usar um token pessoal (PAT)** e clique em **conectar**. O gitview valida o token na API antes de gravar no `.env`; se falhar, nada é escrito. Escopo: `repo` (mais `read:org` para importar times). O token fica só no `.env` da sua máquina.

## Ponte do `gh`

Rode `gh auth login` no terminal e a tela de auth captura a sessão sozinha; **verificar novamente** força a checagem. Enquanto `GITVIEW_GITHUB_TOKEN` estiver vazio, os coletores usam o `gh auth token`. O `gh` é opcional: ninguém precisa dele instalado para coletar.

## Qual token é realmente read-only

O gitview só faz leituras, mas a garantia muda com a credencial:

| credencial | pode escrever? | proteção nos clones |
|---|---|---|
| GitHub App (`Iv…`) com *Contents: Read-only* | não, por permissão do GitHub | nenhuma extra |
| OAuth App (`Ov…`) via device flow | sim, escopo `repo` | push travado |
| PAT clássico | sim, escopo `repo` | push travado |
| `gh auth login` | sim, escopo `repo` | push travado |

Com token `repo` (read+write), a segurança vem do gitview: os clones gerenciados recebem `remote.origin.pushurl=no-push`. A garantia de permissão real só o GitHub App read-only entrega.

## Trocar de conta ou desconectar

- **trocar de conta** refaz o device flow e substitui o token no `.env`.
- **desconectar** limpa a chave do `.env` após confirmação; a coleta fica sem autenticação. Se a ponte do `gh` existir, ela reassume.
- Na ponte do `gh`, troque a conta no terminal (`gh auth login`); a tela de auth detecta a mudança sozinha.
