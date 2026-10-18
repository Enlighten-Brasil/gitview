---
title: Perguntas frequentes
description: "Respostas curtas para as dúvidas comuns do gitview: clones, token e privacidade, Windows, times, merges, publicação e o que é regenerável."
---

# Perguntas frequentes

Respostas curtas para as dúvidas que mais aparecem. Cada uma linka para a página que aprofunda.

## Preciso clonar os repos manualmente?

Não. O setup clona os repositórios que você escolher em `data/repos/` (clones bare gerenciados) e os atualiza com `git fetch` a cada coleta. Se você já mantém clones em algum lugar, aponte `GITVIEW_REPOS_ROOT` para essa pasta — os coletores procuram lá primeiro. Nesse modo os números refletem o estado dos seus clones locais, então dê `git pull` nos repos antes de coletar. Veja o [quick start](./guide/quickstart.md).

## O gh CLI é obrigatório?

Não — ele é uma ponte opcional. A autenticação acontece na UI (device flow ou colando um PAT). Quando `GITVIEW_GITHUB_TOKEN` está vazio e o `gh auth login` está ativo, os coletores caem no `gh auth token`. Veja a [referência de ambiente](./configuration/env.md).

## Meus dados vão para algum servidor?

Não. A coleta grava um banco SQLite local (`data/gitview.db`) e JSONs em `public/data/`; o frontend só lê esses JSONs no browser. As únicas chamadas de saída vão para o GitHub — API e git — durante o setup e a coleta. Veja o [pipeline](./architecture/pipeline.md).

## É seguro? E o token?

O device flow não usa client secret (nunca adicione um) e grava o token no `.env`, que é gitignored. Para garantia de permissão de verdade, use um **GitHub App** com *Repository → Contents: Read-only* — o token emitido é fisicamente incapaz de escrever. Os clones gerenciados também recebem denyPush (`remote.origin.pushurl=no-push`). Veja a [referência de ambiente](./configuration/env.md).

## Meus números mudaram depois de limpar/recoletar. Por quê?

:::info Por que recoletar muda números antigos?
Duas causas usuais. Aliases de identidade: sem mapeamento no `team.local.json`, cada e-mail de commit e login do GitHub conta como um autor próprio, e unificá-los reescreve o `stats.json`. E o `GITVIEW_EXCLUDE_PATHS` (arquivos gerados) só vale para commits novos. Para reescrever o histórico, rode `pnpm clean && pnpm collect` — os botões **limpar e recoletar** (UI) fazem o mesmo. Detalhes na [referência de métricas](./dashboard/metrics.md).
:::

## Funciona no Windows?

Sim. No PowerShell 5.1 chame `pnpm.cmd` — o shim `pnpm.ps1` é bloqueado pela Execution Policy. No `.env`, escreva caminhos com forward slashes (`C:/dev/repos/api`), ou use aspas simples em valores com espaços. Veja a [referência de ambiente](./configuration/env.md).

## Posso usar com outra org/time?

Sim. Defina `GITVIEW_GITHUB_ORG` (e `GITVIEW_DEFAULT_REPOS` para a pré-seleção do setup) e mantenha o cadastro no `team.local.json` — perfis de dev, aliases e times, tudo editável em `/teams`. O projeto não versiona dado de máquina nem de time. Veja a seção do README [Using it with another team/org](https://github.com/Enlighten-Brasil/gitview#using-it-with-another-teamorg).

## Merges não aparecem nas métricas — é bug?

:::info Por que merges não contam?
Por decisão de projeto ([issue #7](https://github.com/Enlighten-Brasil/gitview/issues/7)): 17,6% dos commits eram `Merge …` com +0−0 e inflavam commits/dia, ritmo e streak — a produção do merge já está contada no PR. O filtro é por topologia (`git log --no-merges`), não por assunto. Linhas antigas ainda contêm merges até você rodar `pnpm clean && pnpm collect`.
:::

## Posso publicar a dashboard?

Sim. O `pnpm build` gera um `dist/` 100% estático — sirva-o em qualquer host estático (GitHub Pages, Netlify, nginx…). Ele precisa de fallback de SPA: deep links como `/devs/<nome>` devem servir o `index.html`. No build estático a dashboard é somente leitura: sem `/setup`, `/settings` nem recoleta. Veja [Publishing the dashboard](https://github.com/Enlighten-Brasil/gitview#publishing-the-dashboard-static-build).

## O que é regenerável e o que não é?

O banco (`data/gitview.db*`), os JSONs de `public/data/` e os clones gerenciados são regeneráveis a partir dos repositórios — o `pnpm clean` apaga os dois primeiros (`--repos` inclui os clones). `.env` e `team.local.json` **não** são: são a config da máquina e o cadastro do time, e o `pnpm clean` nunca os toca. Veja o [modelo de dados](./architecture/data-model.md).

## Próximos passos

- [Quick start](./guide/quickstart.md)
- [Arquitetura](./architecture/pipeline.md)
