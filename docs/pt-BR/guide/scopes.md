---
title: Produção vs progresso
description: "A visão de escopo de trabalho para gestores: o que produção e em progresso significam, quais painéis seguem o escopo, quais janelas fixas o ignoram e as limitações conhecidas."
---

# Produção vs progresso

Toda linha de commit que o gitview coleta é classificada contra as refs do repositório no momento da coleta: ou ela está alcançável pela **ref de produção** (trabalho liberado) ou vive numa branch de **integração** ou em outra **branch** (trabalho em progresso). O filtro de escopo da sidebar — os chips **Todos**, **Produção** e **Em progresso** — transforma essa classificação em três visões sobre os mesmos dados. O default é **Todos**; a escolha viaja na URL como `?scope=prod` ou `?scope=progress` e persiste entre navegações.

## O que cada escopo mostra

| Chip | `?scope=` | O que conta |
|---|---|---|
| **Todos** | (omitido) | todas as linhas de commit — o default, os números a que todos estão acostumados |
| **Produção** | `prod` | só as linhas alcançáveis pela ref de produção: o que de fato foi liberado |
| **Em progresso** | `progress` | linhas de integração + branch: trabalho ainda não liberado — a branch da minor atual, features em construção |

Perguntas típicas de gestão: "quanto trabalho não liberado está acumulando?" → **Em progresso**, junto com a [página Branches](../dashboard/branches.md); "o que o time realmente entregou nos últimos 12 meses?" → **Produção**.

## O que segue o escopo

Painéis alimentados por linhas de commit contam só as linhas do escopo selecionado: os cards de resumo e seus deltas, a timeline de commits, os heatmaps, os tipos de commit, as linhas +/−, as contagens por dev e por repo, os campeões semanais, os fix hotspots, **Ritmo — últimas 4 semanas vs 8 anteriores** e **Fora do horário**. As páginas de perfil de dev e de repo seguem o escopo nos seus painéis filtrados também.

Janelas *fixas de período* continuam aplicando o escopo: **Ritmo** e **Fora do horário** no modo **8 semanas** ignoram o filtro de período, mas contam só as linhas do escopo selecionado.

No perfil do dev (`/devs/<nome>`), os cards históricos — **dias ativos**, **commits/dia ativo**, **streak** e **repositórios** — leem o eixo do escopo selecionado quando o dado porta os eixos `byScope` por autor (coletas a partir da issue #152): com **Produção**/**Em progresso** e o eixo presente, o sufixo `(total)` deixa de vir do recorte de escopo (continua marcando o recorte de período). Linha sem os eixos degrada para os contadores históricos com `(total)` — feature-detect na presença de `byScope`.

## O que ignora o escopo (e por quê)

- **PRs, cycle time, reviews** (`/prs`): dados de processo do GitHub não carregam classificação de ref git — um PR é um evento, não uma linha de commit.
- **Releases**: marcos.
- **Inatividade — repos e devs parados**: medida até hoje sobre o histórico completo, de propósito. Se seguisse o escopo **Produção**, um dev que passou o mês inteiro na branch de integração da minor apareceria como inativo justamente por estar fazendo o que foi pedido.
- **Ranking do time (histórico completo)**: contador histórico — a tabela do `/devs` lê a linha integral de `perAuthor`. Streaks e dias ativos são contadores históricos em todo lugar, exceto nos cards históricos do perfil do dev acima, que leem o eixo `byScope` quando o dado o porta.
- **Resumo semanal**: o relatório do time inteiro para a reunião, que ignora todos os filtros da sidebar.
- **Grafo de commits** (`/repos/<name>#grafo`): janela fixa dos últimos N commits — remover commits quebraria as cadeias de merge.
- A página **/branches**: a vista do progresso por natureza — os chips de escopo ficam ocultos nela.

## Limitações conhecidas

- **Dupla contagem do squash**: quando um PR pousa via squash-merge, os commits originais da branch nunca ficam alcançáveis pela produção — eles ficam **Em progresso** para sempre, enquanto o commit squash conta em **Produção**. O mesmo trabalho aparece nos dois escopos e **Todos** soma os dois. A dupla contagem só sai dos totais quando a branch é apagada no remote e uma coleta full posterior expurga os commits inalcançáveis — o que pode diminuir totais históricos retroativamente sem nenhum fato novo por trás (o log do coletor é o único rastro).
- **Ref hint é melhor-esforço**: cada commit registra como dica a primeira ref alcançável; uma branch longeva pode engolir a atribuição.
- **Commit só-remoto fica sem ref hint em checkout normal**: commit alcançável só por remote-tracking refs (sem head local correspondente — clone single-branch, worktree de CI) não ganha dica. Esperado: mesma classe do "alcançável só por tag"; a classificação de escopo continua correta, só falta a dica melhor-esforço. Clones bare gerenciados (padrão do produto) não são afetados — todo ref remoto vira um `refs/heads/*` local. O walk de dica mantém as remote-tracking refs de propósito fora do lado positivo: medido num checkout completo (heads locais + remote-tracking), incluí-las reescrevia dicas já atribuídas (`x` virava `origin/x`) a cada coleta.
- **Dados anteriores à divisão**: coletas feitas antes da classificação prod/progresso não carregam dados de escopo — o dashboard força o filtro para **Todos** nelas. Linhas que não puderam ser classificadas (por exemplo, uma ref de produção não resolvida) ficam fora dos buckets e totais com escopo, com aviso no momento da coleta.

## Onde ler mais

- [Regras dos filtros](../dashboard/filters.md): período, parâmetros de URL, comportamento por rota e as janelas fixas.
- [Glossário de métricas](../dashboard/metrics.md): a fórmula por trás de cada número.
- [Página Branches](../dashboard/branches.md) e [Grafo de commits](../dashboard/graph.md).
- [Coletores](../architecture/collectors.md): como a classificação de escopo roda a cada coleta.
