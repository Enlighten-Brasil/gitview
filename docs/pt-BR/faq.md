---
title: Perguntas frequentes
description: Respostas curtas sobre clones, token e privacidade, Windows, aliases, merges e publicação do dashboard.
---

# Perguntas frequentes

## Preciso clonar os repositórios manualmente?

Não. O setup clona os repos escolhidos em `data/repos/` (clones bare) e roda `git fetch` neles a cada coleta. Com clones próprios, aponte `GITVIEW_REPOS_ROOT` para a pasta que os contém e dê `git pull` antes de coletar: ver [Repositórios](./guide/repositories.md).

## O gh CLI é obrigatório?

Não, é ponte opcional. Autentique pela UI (device flow ou PAT colado); com `GITVIEW_GITHUB_TOKEN` vazio e o `gh` logado, a coleta cai no `gh auth token`: ver [Conectando o GitHub](./guide/connecting-github.md).

## Meus dados saem da máquina?

Não. A coleta grava `data/gitview.db` e os JSONs de `public/data/`, e o navegador só lê esses arquivos. As únicas chamadas de saída vão para o GitHub, no setup e na coleta.

## O gitview escreve nos meus repositórios? E o token?

Não: ele lê `git log`, `git tag` e a API do GitHub, e os clones gerenciados travam o push (`remote.origin.pushurl=no-push`). O token fica no `.env`, gitignored e fora do alcance do dev server. Para leitura garantida por permissão, use um GitHub App com *Contents: Read-only*: ver [Conectando o GitHub](./guide/connecting-github.md).

## Mudei um alias e os números não mudaram. Por quê?

Alias só vale quando os dados são re-agregados: use **salvar + recoletar** em `/teams`. Remover alias não renomeia o que já está no banco, e isso exige `pnpm clean && pnpm collect`: ver [Manutenção dos dados](./configuration/maintenance.md).

## Merges entram nas métricas?

Não. O `git log` é chamado com `--no-merges`, então merge fica fora de commits, ritmo e streaks. Histórico já gravado antes disso mantém os merges até `pnpm clean && pnpm collect`: ver [Glossário de métricas](./dashboard/metrics.md).

## Funciona no Windows?

Sim. No PowerShell 5.1 chame `pnpm.cmd`, porque o shim `pnpm.ps1` é bloqueado pela Execution Policy. Em caminhos do `.env` use barras normais: `C:/dev/repos/api`.

## Posso publicar o dashboard?

Sim. `pnpm build` gera um `dist/` estático para qualquer host estático, com fallback de SPA para deep links. Nesse build o dashboard é somente leitura, sem `/setup`, `/settings` nem recoleta: ver [Publicando o build estático](./guide/publishing.md).

## Próximos passos

- [Quick start](./guide/quickstart.md): do clone ao dashboard.
- [Manutenção dos dados](./configuration/maintenance.md): recoleta e limpeza.
