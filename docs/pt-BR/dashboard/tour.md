---
title: Passeio pelo dashboard
description: Passeio página a página do dashboard do gitview — que pergunta cada página responde, seus painéis e para onde vai cada link.
---

# Passeio pelo dashboard

O gitview é um dashboard somente leitura sobre os seus dados de git: o coletor exporta JSON para `public/data/`, e o frontend só lê. Este passeio percorre as páginas na ordem da navegação. Para cada uma: a pergunta que ela responde, os painéis que você vê (com os rótulos reais da tela), o que é interativo e para onde vão os links. As regras dos filtros têm página própria: [Regras dos filtros](./filters.md).

A rail (barra de ícones à esquerda) agrupa as páginas: **Dashboards** (**Visão geral** `/`, **Devs** `/devs`, **Saúde** `/health`), **Times** `/teams`, **PRs** `/prs`, **Repos** `/repos`, e — só no dev server — **Config** `/settings`. O navbar no topo traz o badge de frescor dos dados, o botão do resumo semanal e (apenas em dev) os controles de coleta.

## Visão geral (`/`) — o que o time está entregando agora?

A página inicial. Três painéis, de cima para baixo:

- **SummaryCards** — o rótulo da seção lê **no período ·** *\<janela\>*. Cards: **commits**, **linhas +**, **linhas −**, **devs ativos**, **repos ativos**. Cada card mostra um delta contra a janela anterior equivalente (tooltip **vs o mês anterior**, **vs os N meses anteriores** ou **vs a janela anterior equivalente**). Uma linha discreta embaixo repete os totais históricos: `histórico total: …`. O delta desaparece em ranges custom e em **Tudo** — ver [Regras dos filtros](./filters.md).
- **AlertStrip** — mostra só o que está fora do saudável (tudo certo, a faixa some). Cada chip é um deep-link para a casa canônica da métrica: PRs parados → `/prs#abertos`, merges sem review → `/prs#reviews`, ritmo → `/devs`, fora do horário e inatividade → `/health`, commits não liberados → `/repos#tabela`.
- **CommitsTimeline** — o título do gráfico é **Commits por semana (por dev)** ou **Commits por mês (por dev)**, com botões de alternância **semana** / **mês**.

Interativo: os painéis de gráfico exportam PNG (ícone de download no cabeçalho do painel, toast **Imagem exportada**); cada chip de alerta navega; cada tooltip de gráfico mostra os números por trás.

Links: chips de alerta (acima); a rail; e tudo o que os filtros da sidebar tocam.

## Devs (`/devs`) — quem está fazendo o quê?

A página de pessoas. Seis painéis:

- **PeriodHighlight** — quem mais commitou no período filtrado (ícone de coroa, badge **N% do período**).
- **WeeklyChampions** — **Campeão da semana — maior evolução**. Duas tabelas: os vencedores recentes por semana (colunas semana / dev / vs média / commits) e a contagem de títulos (**vitórias (período)**). O prêmio premia *evolução* (commits ÷ (média das 8 semanas anteriores + 1), piso de 3 commits na semana), não volume puro — ver [issue #10](https://github.com/Enlighten-Brasil/gitview/issues/10).
- **PaceAlert** — **Ritmo — últimas 4 semanas vs 8 anteriores**. Quem está abaixo da própria linha de base.
- **AuthorMonthHeatmap** — **Dev × mês (comparação)**.
- **ActivityHeatmap** — **Frequência — dia da semana × hora**.
- **DevTable** — **Ranking do time (histórico completo)**. Colunas Dev, commits, + linhas, − linhas, repos, dias ativos, commits/dia ativo, streak, último commit — tudo ordenável menos Dev e commits/dia ativo; botão de exportação **CSV**; e a coluna streak como badge.

Interativo: ordenação de colunas, exportação **CSV** (toast **CSV exportado**), exportação de PNG dos gráficos, tooltips dos heatmaps.

Links: cada nome de dev leva ao perfil `/devs/:name`. O ranking é intencionalmente de histórico completo, ignorando o filtro de período.

:::info Por que o ranking ignora o período?
**Ranking do time (histórico completo)** é uma tabela permanente — quem o time *é*, não quem por acaso entregou no último trimestre. A visão das mesmas pessoas recortada ao período mora nos cards e gráficos acima, e nos heatmaps. O título do painel diz isso em voz alta pra ninguém "corrigir".
:::

## Perfil do dev (`/devs/:name`) — como é o trabalho deste dev?

Responde "o que \<nome\> fez no período selecionado". A rota antiga `/dev/:name` continua funcionando como alias. Se o nome não casa com os dados coletados, a página mostra **Dev não encontrado** e oferece sugestões de **Quis dizer:**.

- **DevStatCards** — **commits**, **linhas +**, **linhas −** (período) mais os cards históricos que ganham o sufixo ` (total)` quando há período ativo: **dias ativos (total)**, **commits/dia ativo (total)**, **streak (total)**, **repositórios (total)**. Com dados do GitHub também: **PRs abertos**, **cycle time mediano**, **reviews feitas**.
- **CommitsTimeline** só deste dev (**Commits por semana** / **Commits por mês**).
- **Distribuição por repositório** (donut) e o heatmap de horários — **Horários de atividade —** *\<janela\>*, ou **Horários de atividade — últimos 24 meses** em **Tudo** (a agregação cobre no máximo 24 meses).
- **PRs abertos de** *\<primeiro nome\>* — os PRs abertos do dev agora (estado *atual*, não recortado ao período).
- **Últimos commits** — a lista de commits do período.

Interativo: alternância de granularidade da timeline, exportação de PNG dos gráficos.

Links: botão **dashboard** no cabeçalho (volta para `/`); linhas de PR levam ao GitHub.

## Saúde (`/health`) — onde o processo dói?

A página de saúde. Cada card documenta os próprios thresholds no rodapé. Painéis:

- **OffHoursPanel** — **Fora do horário**, com alternância de modo: **8 semanas** ou o rótulo da janela atual. Commits de fim de semana/madrugada por dev, com status **pontual** / **atenção** / **padrão**.
- **FixHotspots** — **Fix hotspots — % de correção por repo**.
- **ReviewBottleneck** — **Gargalo de review — quem segura os PRs**.
- **ReviewCoverage** — **Merge sem review — período filtrado**.
- **InactiveWatch** — **Inatividade — repos e devs parados**, dividido em duas listas: **repos sem commit há 30+ dias** e **devs sem commit há 21+ dias**. Medido até hoje — ignora os filtros de propósito.
- **BusFactor** — **Bus factor — concentração por repositório**.

Interativo: alternância de modo de **Fora do horário**; exportação de PNG dos gráficos; as tabelas ordenam pelas colunas de risco onde existem.

Links: os alertas da Visão geral deep-linkam para cá; nada nesta página leva pra fora.

## PRs (`/prs`) — o que está travado e quão rápido os PRs andam?

Precisa do `public/data/github.json` (coletado com `gh` autenticado); sem ele a página mostra **Sem dados do GitHub**. Três seções ancoradas alimentam o sub-nav contextual (**Abertos**, **Cycle time**, **Reviews**):

- `#abertos` — **PrSummaryCards**: **PRs abertos** (com linha auxiliar de rascunhos), **parados há +14 dias**, **mergeados no período**, **cycle time mediano**, **mergeados sem review**. Depois **PrStaleAlert** (**PRs parados — abertos há 14+ dias**) e **PrOpenTable** (**PRs abertos — mais antigos primeiro**).
- `#cycle-time` — **PrCycleTime** (**Cycle time mediano por repo (criação → merge)**) e **CycleTrend** (**Tendência de cycle time — últimos 6 meses** — janela fixa, de propósito).
- `#reviews` — **PrReviews** (**Reviews por dev (no período)**).

Interativo: exportação de PNG dos gráficos; linhas de PR levam ao GitHub.

Links: o sub-nav da rail salta para `#abertos`, `#cycle-time`, `#reviews`; os alertas da Visão geral caem em `#abertos` e `#reviews`.

## Repos (`/repos`) — quais repos estão ativos e estão entregando?

O índice de repositórios. As âncoras alimentam o sub-nav (**Tabela**, **Linhas +/−**, **Distribuição**, **Por mês**, **Tipos de commit**, **Releases**):

- `#tabela` — **Repositórios**: repo / commits / devs / % fix / último commit / última release / não liberados.
- `#linhas` — **Linhas adicionadas × removidas por mês** ou **Crescimento líquido do código (acumulado)**, alternados por **por mês** / **acumulado**.
- `#distribuicao` — **Distribuição por repositório (período filtrado)**.
- `#por-mes` — **Repositório × mês**.
- `#tipos` — **Tipos de commit por mês (feat × fix × ...)** e **Mix por repo (% — ordenado por fix)**.
- `#releases` — **Releases por repositório**, com a nota de rodapé **marcos — ignoram o filtro de período · clique no repo pra ver a cadência completa**. Cada repo mostra a última tag, a idade e a cadência (**X/mês**, calculada sobre os últimos 12 meses fixos).

Interativo: exportação de PNG dos gráficos; linhas e nomes de repo abrem a página do repo.

Links: cada linha leva a `/repos/:name`; o alerta de commits não liberados da Visão geral cai em `#tabela`.

## Repo (`/repos/:name`) — como está este repositório?

O alias `/repo/:name` continua funcionando. Nomes desconhecidos recebem **Repo não encontrado**. O filtro de período vale aqui (commits, gráficos, PRs mergeados, cycle time); releases e PRs abertos são marcos/estado atual e ficam de fora.

- **StatCards** — **commits**, **linhas +**, **linhas −**, **devs** (período); com período ativo também **commits (total)**. Cards de release: **última release (há Nd)** e **commits não liberados** (cor por threshold). Mais **dev principal** (participação do topo, colorido acima de 50%/70%), e com dados do GitHub **PRs abertos** e **cycle time mediano**.
- **Tipos de commit** (donut) e **Commits por dev** (gráfico de barras do top 10).
- **Releases** — tag / data / commits / notas, com **notas** expansível e badge **pré** para prereleases; mostra as 30 tags mais recentes e avisa.

Interativo: linhas de tag abrem a tag no GitHub quando existe URL; **notas** expande inline.

Links: botão **repos** no cabeçalho (volta para `/repos`), link **GitHub ↗** no cabeçalho quando os dados de release trazem um.

:::info Por que releases ignoram o período?
Release é marco — "quando este repo entregou pela última vez" não faz sentido recortado a um trimestre. Os cards e a tabela **Releases** são period-blind de propósito, e os rótulos dizem isso (`(total)`, **marcos — ignoram o filtro de período**). As contagens de commits *entre* tags seguem o período onde aparecem.
:::

## Times (`/teams`) — o editor de times

Só no dev server: no build estático o editor fica desativado e a página diz **edição só no modo dev**. As seções `#times`, `#devs`, `#sem-mapeamento` alimentam o sub-nav.

- `#times` — um **TeamCard** por time: nome, descrição, seletor de cor, chips de membros. O cabeçalho da seção traz **novo time**; **importar do GitHub** (slideover) fica no topo da página. A barra de salvamento oferece **desfazer**, **salvar**, **salvar + recoletar**.
- `#devs` — um **DevCard** por dev com seus logins do GitHub e e-mails de commit; **editar perfil** abre um modal com **título / cargo**, **descrição**, **e-mails de commit**, **logins do GitHub**.
- `#sem-mapeamento` — **TeamCandidatesSection**: identidades coletadas ainda sem mapeamento para um dev, com ações **associar** / **confirmar**. O **CandidatesBanner** das páginas de escopo `full` deep-linka para cá.

Interativo: renomear, recolorir, adicionar/remover membros, importar do GitHub, salvar + recoletar (só em dev).

Links: cada **TeamCard** tem um botão que abre o dashboard do time `/teams/:name`.

## Dashboard do time (`/teams/:name`) — como está este time?

Os mesmos painéis do dashboard principal, mas o filtro de devs fica **travado nos membros do time** (fonte da verdade: `team.json`). O cabeçalho mostra o chip do time, o rótulo da janela, um botão **times** de volta e um botão **ver como filtro livre** — este abre `/?devs=<membros>` como filtro editável.

Painéis: **SummaryCards**, **CommitsTimeline**, **AuthorMonthHeatmap**, **CommitTypes**, depois — com dados do GitHub — **PrSummaryCards**, **PrOpenTable**, **PrCycleTime**, e por fim **OffHoursPanel**. Os chips de membros levam ao perfil de cada dev.

Interativo: igual aos painéis que a página reutiliza; chips de membros navegam.

Links: chips de membros → `/devs/:name`; **ver como filtro livre** → `/` com `?devs=…`; times renomeados redirecionam sozinhos (URLs antigas continuam vivas via `teams[].renamedFrom`). Nomes desconhecidos recebem **Time não encontrado** com sugestões de **Times disponíveis:**.

## Resumo semanal — a exportação pronta pra reunião

Não é uma rota — é um botão no navbar (tooltip **resumo da semana exportável**). Ele abre um slideover intitulado **Resumo da semana** com o markdown da **última semana ISO fechada** (seg–dom) comparada com a anterior: `## Commits`, `## Pull requests`, `## Releases`, `## Atenção`. Exporte com **copiar markdown** (o botão vira **copiado!**) ou **baixar .md** (grava `resumo-<weekKey>.md`). O relatório cobre o *time inteiro* pra reunião semanal — por isso sempre exclui bots e nunca lê os filtros da sidebar; as visões de "e se" filtradas pertencem aos dashboards.

## O build estático é somente leitura

O frontend só lê os arquivos JSON de `public/data/` — `pnpm build` gera um `dist/` 100% estático que você serve em qualquer host estático (GitHub Pages, Netlify, nginx…). Ele precisa de **SPA fallback**: deep-links como `/devs/<name>` devem servir `index.html` (o router usa `createWebHistory`).

Nesse build o dashboard é estritamente somente leitura: `/setup`, `/settings` e os botões de coleta (↻, **coleta completa (--full)**) não existem, e o editor de `/teams` fica desativado — os endpoints `/__*` são middleware do dev server. Unifique identidades e ajuste times sob `pnpm dev`, recolete com `pnpm collect`, e só então publique.

## Próximos passos

- [Regras dos filtros](./filters.md) — como o período, os times e os filtros da URL se comportam de verdade (incluindo as janelas fixas).
- `README.md` — instalar, coletar, publicar (seção "Publishing the dashboard (static build)").
