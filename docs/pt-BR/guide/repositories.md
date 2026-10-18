---
title: Repositórios
description: Escolha os repos que entram no dashboard, como os clones gerenciados ficam frescos e como apontar o gitview para clones seus.
---

# Repositórios

O gitview lê os repositórios de uma pasta — `data/repos/` por padrão. O wizard pode preenchê-la para você (clones gerenciados), ou você aponta o `GITVIEW_REPOS_ROOT` para clones que já existem.

## Como escolher os repositórios?

Passo 2 do wizard (**escolher repositórios**, rota `/setup/repos`) — ou depois por Configurações → **gerenciar repositórios**. O picker lista os repos pela API do GitHub:

- **organização** — suas orgs, mais uma entrada `<login> (pessoal)` com seus repos pessoais;
- **buscar repositórios** — filtra a lista enquanto você digita;
- pré-seleção — os repos do `GITVIEW_DEFAULT_REPOS` (CSV no `.env`); com o CSV vazio, todos os não arquivados vêm pré-selecionados. **padrão do time** reaplica o CSV, **todos** seleciona todo não arquivado, **nenhum** limpa a seleção;
- badges — **arquivado** nos repos arquivados (não selecionáveis) e **atual** nos repos que já estão no dashboard ao gerenciar.

Só os repos que faltam são clonados, em paralelo (pool de 4). No modo gerenciar, desmarcar um repo atual avisa **N repo(s) serão removidos do disco: \<names\>** e o apply (**aplicar mudanças**) apaga o clone após a confirmação **Apagar repositórios do disco?** → **apagar e aplicar**. Remoção é sempre explícita — o gitview nunca faz prune de clones só porque saíram de uma lista.

## O que são os clones gerenciados?

O setup clona cada repo como clone bare em `data/repos/` (gitignored) e grava `GITVIEW_REPOS_ROOT=data/repos` no `.env`. A partir daí os clones são mantidos para você:

- toda coleta começa com `git fetch --all --prune --tags` em cada clone gerenciado (fetch que falha cai no cache local com warning);
- o token é injetado só pelo ambiente do processo do git (`GIT_CONFIG_COUNT/KEY/VALUE`, Basic `x-access-token`) — nunca na linha de comando, nunca gravado no config do clone;
- cada clone recebe `remote.origin.pushurl=no-push` (idempotente, reaplicado a cada coleta), então o git não consegue nem dar push se algo tentar.

:::info Por que a URL de push fica travada?
OAuth Apps e `gh auth login` entregam tokens com escopo `repo`, que é read+write. O gitview só lê — mas em vez de confiar apenas no caminho de código, os clones gerenciados travam a URL de push no nível do git. A garantia de permissão real continua vindo de um GitHub App com *Contents: Read-only* (ver [Conectando o GitHub](./connecting-github.md)).
:::

## Como apontar o gitview para clones que já existem?

Defina `GITVIEW_REPOS_ROOT` apontando para a pasta que os contém — um repo por subpasta, checkouts normais e bare funcionam. Os coletores resolvem a pasta nesta ordem:

1. variável de ambiente `GITVIEW_REPOS_ROOT` (shell)
2. `GITVIEW_REPOS_ROOT` no `.env`
3. padrão: `data/repos` (os clones gerenciados)

Caminhos relativos resolvem a partir da raiz do projeto. Em Windows, barra normal funciona (`C:/dev/repos/api`) — ou aspas simples se o caminho tiver espaços.

## O que fazer quando os números mudam?

Com clones gerenciados: nada — o fetch roda no início de toda coleta.

Com clones que você mesmo gerencia: os dados refletem o estado dos seus clones locais. Dê `git pull` nos repos antes de coletar se quiser números frescos. Quando os totais parecerem velhos, o badge da navbar diz quão frescos estão os dados.

## Próximos passos

- [O wizard de configuração](./setup-wizard.md) — onde o picker fica no fluxo.
- [Conectando o GitHub](./connecting-github.md) — para que serve o token.
- [Referência: métricas](../dashboard/metrics.md) — o que os coletores contam.
