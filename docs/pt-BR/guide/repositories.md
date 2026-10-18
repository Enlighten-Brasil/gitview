---
title: Repositórios
description: "Escolha dos repositórios do dashboard, como os clones gerenciados se atualizam e como usar clones próprios."
---

# Repositórios

O gitview lê os repositórios de uma pasta, `data/repos/` por padrão. O wizard preenche a pasta com clones gerenciados, ou você aponta `GITVIEW_REPOS_ROOT` para clones que já existem.

## Como escolher os repositórios

O picker do passo 2 (`/setup/repos`) e de Configurações → **gerenciar repositórios** lista os repos pela API do GitHub:

- **organização**: suas orgs, mais a entrada `<login> (pessoal)` com seus repos pessoais;
- **buscar repositórios**: filtra a lista enquanto você digita;
- pré-seleção: o CSV de `GITVIEW_DEFAULT_REPOS`; vazio = todos os não arquivados. Atalhos **padrão do time**, **todos**, **nenhum**;
- badges: **arquivado** (não selecionável) e **atual** (já no dashboard, ao gerenciar).

Só os repos que faltam são clonados, em paralelo. No modo gerenciar, desmarcar um repo atual apaga o clone do disco após a confirmação **Apagar repositórios do disco?** → **apagar e aplicar**. A remoção é sempre explícita: o gitview nunca faz prune de clones só porque saíram da lista.

## O que são os clones gerenciados

O setup clona cada repo como clone bare (sem working tree) em `data/repos/` e grava `GITVIEW_REPOS_ROOT=data/repos` no `.env`. Depois disso:

- toda coleta começa com `git fetch --all --prune --tags` em cada clone gerenciado; fetch que falha cai no cache local com warning;
- o token é injetado só no ambiente do processo do git, nunca na linha de comando nem no config do clone;
- cada clone recebe `remote.origin.pushurl=no-push`: push é impossível no nível do git.

## Como apontar para clones que já existem

Defina `GITVIEW_REPOS_ROOT` com a pasta que contém os repos, um por subpasta. Checkouts normais e bare funcionam. A precedência dos valores e o formato dos caminhos estão em [O arquivo `.env`](../configuration/env.md).

Nesse modo os números refletem o estado dos seus clones locais: rode `git pull` nos repos antes de coletar para ter dados frescos. O badge de frescor na navbar diz quando a coleta foi feita.
