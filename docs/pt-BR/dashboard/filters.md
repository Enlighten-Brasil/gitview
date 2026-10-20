---
title: Regras dos filtros
description: O comportamento de período, escopo de trabalho, repos, devs e bots em cada rota, e as janelas fixas que ignoram o período.
---

# Regras dos filtros

Estado global compartilhado por todas as páginas: período, escopo de trabalho, repos, devs e bots. Cada rota declara o que a sidebar mostra e o que vai para a URL. Toda janela que ignora o período está rotulada na própria tela.

## Período

| Controle | Janela |
|---|---|
| **1M** **3M** **6M** **12M** **24M** | N meses para trás a partir de hoje, default **12M** |
| **Tudo** | todo o histórico coletado |
| **Personalizado** | datas **de** e **até** (`dateFrom`, `dateTo`, `YYYY-MM-DD`) |

- O range custom prevalece sobre o preset: na URL, `from` e `to` vencem, `range` é ignorado e os presets aparecem desselecionados.
- O range custom corta por mês inteiro. A agregação é mensal ou semanal, então um `from` no meio do mês inclui o mês completo.
- Os deltas dos cards são omitidos em range custom e em **Tudo**: não existe janela de comparação equivalente.
- O último preset usado persiste no `localStorage` (`gitview:range`) e uma URL sem parâmetros de período cai nele; estado zerado usa **12M**.

## Escopo de trabalho (produção vs progresso)

Toda linha de commit carrega uma classificação feita na coleta: produção (alcançável pela ref de produção) ou progresso (integração e demais branches). O filtro de escopo — os chips **Todos** / **Produção** / **Em progresso** — escolhe quais linhas os painéis alimentados por commits contam:

| Chip | `?scope=` | Conta |
|---|---|---|
| **Todos** | (omitido) | todas as linhas de commit — o default |
| **Produção** | `prod` | só as linhas alcançáveis pela ref de produção: trabalho liberado |
| **Em progresso** | `progress` | linhas de integração + branch: trabalho ainda não liberado |

- Como o período, o escopo vale em toda rota de dados (`full`, `team`, `period`, `period-bots`); rotas `none` não o carregam e `/branches` não o consome (a página é por natureza a vista do progresso — os chips ficam ocultos nela).
- A última escolha persiste no `localStorage` (`gitview:scope`) e uma URL sem `scope` cai nela; valor inválido volta para **Todos**. Dados coletados antes da divisão prod/progresso forçam **Todos** (feature-detect em `totals.prodCommits`).
- Painéis alimentados por linhas de commit seguem o escopo — inclusive as janelas fixas **Ritmo** e **Fora do horário** no modo **8 semanas**, que ignoram o período mas aplicam o escopo. PRs, cycle time, reviews, releases, inatividade, o ranking de histórico completo, streaks, o resumo semanal, o grafo de commits e `/branches` leem dados sem classificação de escopo.
- O que cada escopo significa para a gestão e as limitações conhecidas (dupla contagem do squash, ref hint melhor-esforço): [Produção vs progresso](../guide/scopes.md).

## Parâmetros de URL

A sidebar grava os filtros na query string, então links e favoritos reproduzem a visão exata. Defaults são omitidos: `range` só aparece quando não é **12M**.

| Parâmetro | Significado | Exemplo |
|---|---|---|
| `range` | preset `1`, `3`, `6`, `12`, `24` ou `all` | `?range=6` |
| `from`, `to` | range custom `YYYY-MM-DD`, vence `range` | `?from=2026-01-01&to=2026-06-30` |
| `repos` | repos selecionados, separados por vírgula | `?repos=api,web` |
| `devs` | devs selecionados, separados por vírgula | `?devs=Ana,Bruno` |
| `bots` | `1` mostra bots | `?bots=1` |
| `scope` | escopo de trabalho: `prod` ou `progress` (default `all`, omitido) | `?scope=prod` |

- As escritas usam `replaceState`, então filtrar não polui o histórico do navegador.
- Voltar e avançar tomam a URL como verdade: o estado volta aos defaults e a URL é aplicada.
- Valores que não existem mais nos dados (um repo renomeado) saem da seleção quando os dados carregam.

## Escopo por rota

O escopo decide o que a sidebar mostra e o que a URL carrega. Todo filtro que muda uma página aparece naquela página: não existe filtro invisível.

| Escopo | Rotas | URL carrega | Sidebar mostra |
|---|---|---|---|
| `full` | `/`, `/devs`, `/health`, `/prs`, `/branches`, `/repos` | período, escopo, `repos`, `devs`, `bots` | **Período**, **Times**, **Repos**, **Devs** |
| `team` | `/teams/:name` | período, escopo, `repos` | **Período**, **Repos** |
| `period` | `/devs/:name` | período, escopo | **Período** |
| `period-bots` | `/repos/:name` | período, escopo, `bots` | **Período** e **incluir bots** |
| `none` | `/teams`, `/setup`, `/settings`, 404 | nada | nada |

As seções **Repos** e **Devs** trazem ações em massa (**selecionar todos**, **inverter seleção**, **limpar**) e o botão **limpar filtros** quando há seleção.

## Chips de time na sidebar

A seção **Times** (só no escopo `full`, só com membros visíveis) é um atalho sobre a lista **Devs**.

- Um clique seleciona ou desmarca todos os membros do time de uma vez; o estilo do chip mostra todos, parcial ou nenhum.
- O time nunca vai para a URL: a seleção se materializa na lista de devs, então o link carrega `devs=Ana,Bruno,…` e reproduz as mesmas pessoas para quem não tem o seu cadastro de times.
- Só contam membros presentes na lista de autores visível; bots escondidos ficam de fora enquanto **incluir bots** estiver desligado.

## `/teams/:name` travado nos membros

- A página trava a seleção de devs nos membros do time, que vêm do cadastro de times. A sidebar esconde **Devs** e bots, e a URL leva só período e `repos`.
- Sair da página mantém os membros como seleção visível no dashboard.
- Time renomeado: `/teams/<nome-antigo>` resolve para o nome atual, então links compartilhados continuam vivos.
- **ver como filtro livre** abre `/` com `?devs=<membros>`: as mesmas pessoas, agora editáveis.

## Navegação mantém o contexto

Seguir um link (nome de dev, linha de repo, chip de alerta) aplica os parâmetros presentes na URL sem resetar o resto e regrava a query no escopo da nova rota. O período escolhido acompanha a navegação; voltar e avançar usam a URL como verdade.

## Janelas fixas que ignoram o período

| Painel | Janela | Onde |
|---|---|---|
| **Ritmo — últimas 4 semanas vs 8 anteriores** | últimas 4 semanas contra as 8 anteriores | `/devs` |
| **Fora do horário** no modo **8 semanas** | últimas 8 semanas, o modo período segue a sidebar | `/health`, `/teams/:name` |
| **Tendência de cycle time — últimos 6 meses** | últimos 6 meses | `/prs` |
| **PRs abertos** | estado agora | `/prs`, `/devs/:name`, `/repos/:name` |
| **Ranking do time (histórico completo)** | histórico completo | `/devs` |
| **Inatividade — repos e devs parados** | até hoje, ignora todos os filtros | `/health` |
| **Releases por repositório** | marcos, rodapé **marcos — ignoram o filtro de período** | `/repos` |
| **Grafo de commits** (`#grafo`) | os últimos N commits do repo (`window` no JSON, rotulado no rodapé); também ignora bots e escopo | `/repos/:name` |

Cada painel fixo declara a própria janela no título ou no rodapé porque a pergunta define a janela: o ritmo é, por definição, 4 semanas contra as 8 anteriores. As janelas fixas respeitam repos, devs e bots, e as alimentadas por linhas de commit (ritmo, fora do horário no modo **8 semanas**) respeitam também o escopo de trabalho; só releases e inatividade ignoram a sidebar inteira. As fórmulas estão em [Glossário de métricas](./metrics.md).

## O que segue o período em `/devs/:name` e `/repos/:name`

Cards de commits, linhas e devs, gráficos, PRs mergeados, cycle time, reviews e listas de commits ficam recortados à janela; **Tudo** significa histórico completo. Ficam fora, cada um rotulado:

- **dias ativos (total)**, **commits/dia ativo (total)**, **streak (total)** e **repositórios (total)**: contadores históricos com sufixo `(total)` quando há período ativo.
- **PRs abertos**: estado atual. **Releases**: marcos.
- Em **Tudo**, o heatmap de horas cobre no máximo 24 meses (**Horários de atividade — últimos 24 meses**), o limite da agregação.
- Nessas rotas a sidebar mostra só o seletor de período, mais **incluir bots** em `/repos/:name`, onde a chave vale para os commits, os tipos de commit e os PRs do repo.
