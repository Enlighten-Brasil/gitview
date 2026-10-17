---
title: Regras dos filtros
description: Como os presets de período, ranges custom, chips de time e filtros de URL se comportam — incluindo as janelas fixas que ignoram o período.
---

# Regras dos filtros

Os filtros são estado global compartilhado por todas as páginas do dashboard: um período, uma lista de repos, uma lista de devs e uma chave de bots. Esta página é o livro de regras — incluindo as janelas que ignoram o seu período de propósito. A spec vive em `AGENTS.md` ("Regras dos filtros"); o código é `src/filters-core.ts` (estado), `src/filters.ts` (ações) e `src/urlState.ts` (sync com a URL).

## Período: presets ou range custom

| Controle | Janela |
|---|---|
| **1M** **3M** **6M** **12M** **24M** | N meses para trás a partir de hoje (default: **12M**) |
| **Tudo** | todo o histórico coletado |
| **Personalizado** | inputs de data **de** / **até** (`dateFrom`/`dateTo`, `YYYY-MM-DD`) |

Regras fáceis de confundir com bugs:

- Um range custom **prevalece sobre o preset**. Na URL, `from`/`to` vencem e `range` é ignorado; os botões de preset se desselecionam enquanto **Personalizado** está ativo.
- O range custom **corta por mês inteiro**. A agregação é mensal/semanal (chaves de mês como `2026-03`), então um `from` no meio de um mês inclui aquele mês por completo.
- Os deltas dos cards (o pequeno % vs a janela anterior nos cards da Visão geral) são **omitidos** em ranges custom e em **Tudo** — não existe janela de comparação equivalente.
- O último preset que você usou persiste no `localStorage` (`gitview:range`); uma URL sem parâmetros de período cai nele. Estado zerado usa **12M** por padrão.

## O que vive na URL

A sidebar grava os filtros na query string, então links e favoritos reproduzem a visão exata:

| Parâmetro | Significado | Exemplo |
|---|---|---|
| `range` | preset: `1`, `3`, `6`, `12`, `24` ou `all` | `?range=6` |
| `from`, `to` | range custom, `YYYY-MM-DD` — vence `range` | `?from=2026-01-01&to=2026-06-30` |
| `repos` | repos selecionados, separados por vírgula | `?repos=api,web` |
| `devs` | devs selecionados, separados por vírgula | `?devs=Ana,Bruno` |
| `bots` | `1` = mostrar bots | `?bots=1` |

- Defaults são omitidos para manter as URLs limpas (ex.: `range` só aparece quando não é **12M**).
- Escritas usam `replaceState` — clicar em filtros não polui o histórico do navegador.
- Voltar/avançar (`popstate`): a URL é a fonte da verdade. O estado volta aos defaults e depois a URL é aplicada.
- Sanitização: valores que não existem mais nos dados (ex.: um repo renomeado) saem da seleção quando os dados carregam.

## Escopo de filtro por rota

Cada rota declara um escopo em `route.meta.filters`. O escopo decide o que vai para a URL **e** o que a sidebar mostra — nada é aplicado de forma invisível:

| Rota | Escopo | URL carrega | Sidebar mostra |
|---|---|---|---|
| `/`, `/devs`, `/health` | `full` | período, `repos`, `devs`, `bots` | **Período**, **Times**, **Repos**, **Devs** |
| `/prs` | `full` | período, `repos`, `devs`, `bots` | **Período**, **Times**, **Repos**, **Devs** |
| `/repos` | `full` | período, `repos`, `devs`, `bots` | **Período**, **Times**, **Repos**, **Devs** |
| `/teams/:name` | `team` | período, `repos` | **Período**, **Repos** |
| `/devs/:name` | `period` | período | **Período** |
| `/repos/:name` | `period-bots` | período, `bots` | **Período** + **incluir bots** |
| `/teams` (editor), `/setup`, `/settings`, 404 | `none` | — (o urlState não atua) | — |

As seções **Repos** e **Devs** da sidebar trazem ações em massa (**selecionar todos**, **inverter seleção**, **limpar**) e um botão **limpar filtros** quando algo está selecionado.

:::info Por que /prs e /repos mostram os filtros?
Desde 0.33, `/prs` e `/repos` (índice) usam o escopo `full`: filtros visíveis na sidebar **e** na URL. Antes eles ficavam escondidos mas continuavam aplicados — o clássico "filtro fantasma" que fazia os números divergirem entre páginas. Se um filtro muda uma página, essa página o mostra.
:::

## Chips de time na sidebar

A seção **Times** (só no escopo `full`, só quando os times têm membros visíveis) é um atalho sobre a lista **Devs**:

- Clicar num chip de time seleciona/deseleciona **todos os membros de uma vez**. O chip mostra o estado pelo estilo: todos selecionados, parcialmente selecionados ou nenhum.
- O time em si nunca chega à URL — a seleção **se materializa em `filters.authors`**, então a URL carrega `devs=Ana,Bruno,…`. Um link compartilhado reproduz as mesmas pessoas mesmo para quem não tem o seu `team.json`.
- Só contam membros que existem na lista de autores visível (bots escondidos a menos que **incluir bots** esteja ligado).

## `/teams/:name` — travado nos membros

- A página **trava `filters.authors` nos membros do time** (fonte da verdade: `team.json`). A sidebar não mostra **Devs** nem bots — a URL carrega só período + `repos`, porque `/teams/<nome>` já é o contexto compartilhável.
- Sair da página mantém os membros como a seleção *visível* no dashboard. Mesma regra de sempre: nenhum filtro invisível.
- Times renomeados redirecionam: `/teams/<nome-antigo>` resolve para o nome atual (`teams[].renamedFrom`, gravado pelo editor de `/teams`), então links compartilhados continuam vivos.
- **ver como filtro livre** abre `/` com `?devs=<membros>` — as mesmas pessoas, editável.

## A navegação mantém o seu contexto

Seguir um link (um nome de dev, uma linha de repo, um chip de alerta) aplica os parâmetros presentes na URL **sem resetar o resto**, e depois reescreve a query para o escopo da nova rota. O período que você escolheu te acompanha entre páginas. Voltar/avançar toma a URL como verdade.

## Janelas fixas que ignoram o período

Alguns painéis respondem perguntas de "agora" ou "historicamente". Eles ignoram o filtro de período de propósito e dizem isso no próprio rótulo:

| Rótulo exibido | Janela | Onde |
|---|---|---|
| **Ritmo — últimas 4 semanas vs 8 anteriores** | últimas 4 semanas vs as 8 anteriores | `/devs` (PaceAlert) |
| **Fora do horário** — modo **8 semanas** | últimas 8 semanas (o outro botão segue o período) | `/health`, `/teams/:name` (OffHoursPanel) |
| **Tendência de cycle time — últimos 6 meses** | últimos 6 meses | `/prs` (CycleTrend) |
| **PRs abertos** / **PRs abertos — mais antigos primeiro** | PRs abertos agora | `/prs`, `/devs/:name`, `/repos/:name` |
| **Ranking do time (histórico completo)** | histórico completo | `/devs` (DevTable) |
| **Inatividade — repos e devs parados** | medido até hoje — ignora todos os filtros | `/health` (InactiveWatch) |
| **Releases por repositório** | marcos (nota de rodapé: **marcos — ignoram o filtro de período**) | `/repos` (RepoReleasesGrid) |

:::info Por que existem janelas fixas que ignoram o período?
Porque a pergunta e a janela são a mesma coisa. "O ritmo está caindo?" é definido como 4 semanas vs as 8 anteriores — recortar isso para `?range=1` destruiria a comparação e produziria um número sem sentido. Cada painel fixo declara a própria janela no título, então você nunca precisa adivinhar em qual filtro um número está.
:::

## `/devs/:name` e `/repos/:name` — o que segue o período

Desde 0.27.0, essas páginas de perfil **respeitam o filtro de período**: cards de commits/linhas/devs, gráficos, PRs mergeados, cycle time, reviews e as listas de commits ficam recortados à janela. **Tudo** significa histórico completo.

Ficam fora do período por decisão (cada um rotulado):

- **dias ativos (total)**, **commits/dia ativo (total)**, **streak (total)**, **repositórios (total)** — contadores históricos, sufixo ` (total)` quando há período ativo.
- **PRs abertos** — estado atual.
- **Releases** — marcos (ver `/repos/:name`).

O heatmap de horas sob **Tudo** cobre no máximo 24 meses (**Horários de atividade — últimos 24 meses**) — é o limite da agregação.

Nessas rotas a sidebar mostra **só o seletor de período** (mais **incluir bots** em `/repos/:name`, onde a chave se aplica aos commits do repo, tipos de commit e PRs).

## Próximos passos

- [Passeio pelo dashboard](./tour.md) — o que cada página responde e onde mora cada painel.
- `AGENTS.md` ("Regras dos filtros") — a spec que esta página segue, no repositório.
