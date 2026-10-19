---
title: Passeio pelo dashboard
description: "Cada página do dashboard do gitview: a pergunta que responde, os painéis na tela e para onde vão os links."
---

# Passeio pelo dashboard

As páginas vêm na ordem da navegação. Para cada uma: a pergunta que ela responde, os painéis com os rótulos reais da tela e as saídas dos links. O comportamento dos filtros tem casa própria em [Regras dos filtros](../dashboard/filters.md); o pipeline de dados, em [Pipeline](../architecture/pipeline.md). As capturas usam os dados sintéticos da demo pública, nunca dados reais do time.

A rail à esquerda agrupa **Dashboards** (**Visão geral** `/`, **Devs** `/devs`, **Saúde** `/health`), **Times** `/teams`, **PRs** `/prs`, **Repos** `/repos` e, só no dev server, **Config** `/settings`. A navbar traz o badge de frescor dos dados, o botão do resumo semanal e, em dev, os controles de coleta. Todo painel de gráfico exporta PNG pelo ícone de download (toast **Imagem exportada**) e os tooltips mostram os números por trás de cada ponto.

## Visão geral (`/`): o que o time está entregando agora?

- Cards de resumo, sob o rótulo **no período ·** *\<janela\>*: **commits**, **linhas +**, **linhas −**, **devs ativos**, **repos ativos**, cada um com o delta contra a janela anterior equivalente. A linha discreta **histórico total: …** repete os totais.
- Faixa de alertas: só o que está fora do saudável, e some quando está tudo certo. Cada chip leva à casa canônica da métrica: PRs parados → `/prs#abertos`, merges sem review → `/prs#reviews`, ritmo → `/devs`, fora do horário e inatividade → `/health`, commits não liberados → `/repos#tabela`.
- **Commits por semana (por dev)** ou **Commits por mês (por dev)**, alternado pelos botões **semana** e **mês**.

![Visão geral: cards de resumo, faixa de alertas e commits por semana (demo)](/screenshots/overview.png)

## Devs (`/devs`): quem está fazendo o quê?

- Destaque do período: quem mais commitou, com coroa e badge **N% do período**.
- **Campeão da semana — maior evolução**: os vencedores por semana (semana / dev / vs média / commits) e a contagem **vitórias (período)**. O prêmio mede evolução contra a própria linha de base, não volume; a fórmula está em [Glossário de métricas](../dashboard/metrics.md).
- **Ritmo — últimas 4 semanas vs 8 anteriores**: quem está abaixo da própria média.
- **Dev × mês (comparação)**.
- **Frequência — dia da semana × hora**.
- **Ranking do time (histórico completo)**: Dev, commits, + linhas, − linhas, repos, dias ativos, commits/dia ativo, streak e último commit. Ordenável menos Dev e commits/dia ativo, com exportação **CSV** (toast **CSV exportado**) e o recorde como badge `máx` na coluna de streak. É histórico completo de propósito; a visão recortada ao período está nos cards e heatmaps acima.

Cada nome de dev abre o perfil `/devs/:name`.

## Perfil do dev (`/devs/:name`): como é o trabalho deste dev?

Responde o que a pessoa fez no período selecionado. `/dev/:name` continua como alias; nome sem correspondência nos dados mostra **Dev não encontrado** com sugestões **Quis dizer:**.

- Cards de **commits**, **linhas +**, **linhas −** no período, mais **dias ativos (total)**, **commits/dia ativo (total)**, **streak (total)**, **repositórios (total)**; com dados do GitHub, também **PRs abertos**, **cycle time mediano**, **reviews feitas**.
- **Commits por semana** / **Commits por mês** só deste dev.
- **Distribuição por repositório** (donut) e **Horários de atividade —** *\<janela\>*, que em **Tudo** vira **Horários de atividade — últimos 24 meses** (limite da agregação).
- **PRs abertos de** *\<primeiro nome\>*: estado atual, não recortado ao período.
- **Últimos commits**: os commits do período.

O botão **dashboard** volta para `/`; linhas de PR abrem o GitHub.

![Perfil do dev: cards de métricas, commits por semana e distribuição por repositório (demo)](/screenshots/dev.png)

## Saúde (`/health`): onde o processo dói?

Cada card documenta os próprios thresholds no rodapé; os valores estão em [Glossário de métricas](../dashboard/metrics.md).

- **Fora do horário**: alternado entre **8 semanas** e o rótulo da janela atual. Commits de fim de semana e madrugada por dev, com status **pontual**, **atenção**, **padrão**.
- **Fix hotspots — % de correção por repo**.
- **Gargalo de review — quem segura os PRs**.
- **Merge sem review — período filtrado**.
- **Inatividade — repos e devs parados**: **repos sem commit há 30+ dias** e **devs sem commit há 21+ dias**. Medido até hoje, ignora os filtros.
- **Bus factor — concentração por repositório**.

As tabelas ordenam onde existe coluna de risco; os alertas da Visão geral apontam para cá e nada daqui leva para fora.

![Página Saúde: fora do horário, fix hotspots, gargalo de review e merge sem review (demo)](/screenshots/health.png)

## PRs (`/prs`): o que está travado e quão rápido os PRs andam?

Depende dos dados do GitHub, coletados com `gh` autenticado; sem eles a página mostra **Sem dados do GitHub**. O sub-nav contextual cobre três âncoras e os alertas da Visão geral caem em `#abertos` e `#reviews`.

- `#abertos`: cards **PRs abertos** (com linha auxiliar de rascunhos), **parados há +14 dias**, **mergeados no período**, **cycle time mediano**, **mergeados sem review**; depois **PRs parados — abertos há 14+ dias** e **PRs abertos — mais antigos primeiro**.
- `#cycle-time`: **Cycle time mediano por repo (criação → merge)** e **Tendência de cycle time — últimos 6 meses**, de janela fixa.
- `#reviews`: **Reviews por dev (no período)**.

Linhas de PR abrem o GitHub.

![Página PRs: cards de resumo, tabelas de PRs parados e abertos, cycle time por repositório (demo)](/screenshots/prs.png)

## Repos (`/repos`): quais repos estão ativos e entregando?

Índice de repositórios, com sub-nav por âncora (**Tabela**, **Linhas +/−**, **Distribuição**, **Por mês**, **Tipos de commit**, **Releases**). O alerta de commits não liberados da Visão geral cai em `#tabela`.

- `#tabela` **Repositórios**: repo / commits / devs / % fix / último commit / última release / não liberados. Cada linha abre `/repos/:name`.
- `#linhas` **Linhas adicionadas × removidas por mês** ou **Crescimento líquido do código (acumulado)**, alternado por **por mês** e **acumulado**.
- `#distribuicao` **Distribuição por repositório (período filtrado)**.
- `#por-mes` **Repositório × mês**.
- `#tipos` **Tipos de commit por mês (feat × fix × ...)** e **Mix por repo (% — ordenado por fix)**.
- `#releases` **Releases por repositório**: última tag, idade e cadência **X/mês** sobre os últimos 12 meses. Rodapé **marcos — ignoram o filtro de período · clique no repo pra ver a cadência completa**.

## Repo (`/repos/:name`): como está este repositório?

`/repo/:name` continua como alias; nome desconhecido mostra **Repo não encontrado**. O período vale para commits, gráficos, PRs mergeados e cycle time; releases e PRs abertos são marcos ou estado atual, como descreve [Regras dos filtros](../dashboard/filters.md).

- Cards de **commits**, **linhas +**, **linhas −**, **devs** no período, **commits (total)** quando há período ativo, **última release (há Nd)**, **commits não liberados** (cor por threshold), **dev principal** com a participação do topo (colorida acima de 50% e 70%) e, com dados do GitHub, **PRs abertos** e **cycle time mediano**.
- **Tipos de commit** (donut) e **Commits por dev** (barras, top 10).
- **Releases**: tag / data / commits / notas, badge **pré** para prereleases e **notas** expansível inline; as 30 tags mais recentes, com aviso. As contagens de commits *entre* tags seguem o período onde aparecem.

Linhas de tag abrem o GitHub quando existe URL; o botão **repos** volta para `/repos` e **GitHub ↗** abre o repositório quando os dados de release trazem a URL.

## Times (`/teams`): o editor de times

Só no dev server; no build estático a página avisa **edição só no modo dev**. As seções alimentam o sub-nav e cada card de time tem botão para o dashboard `/teams/:name`.

- `#times`: um card por time (nome, descrição, seletor de cor, chips de membros), **novo time** no cabeçalho da seção e **importar do GitHub** no topo da página. A barra de salvamento traz **desfazer**, **salvar** e **salvar + recoletar**.
- `#devs`: um card por dev com logins do GitHub e e-mails de commit; **editar perfil** abre modal com **título / cargo**, **descrição**, **e-mails de commit** e **logins do GitHub**.
- `#sem-mapeamento`: identidades coletadas ainda sem dev associado, com **associar** e **confirmar**. O banner de candidatos das páginas de dashboard aponta para cá.

## Dashboard do time (`/teams/:name`): como está este time?

Os mesmos painéis da Visão geral, com a seleção de devs travada nos membros do time (o cadastro de times é a fonte da verdade). O cabeçalho traz o chip do time, o rótulo da janela, o botão **times** e **ver como filtro livre**, que abre `/?devs=<membros>` como filtro editável.

Painéis: cards de resumo, commits por semana, **Dev × mês (comparação)** e tipos de commit; com dados do GitHub, os cards de PR, **PRs abertos — mais antigos primeiro** e **Cycle time mediano por repo**; e **Fora do horário**. Chips de membros abrem `/devs/:name`; time renomeado redireciona a partir da URL antiga; nome desconhecido mostra **Time não encontrado** com **Times disponíveis:**.

## Resumo semanal: a exportação pronta para a reunião

Botão no navbar (tooltip **resumo da semana exportável**), não uma rota. Abre o slideover **Resumo da semana** com o markdown da última semana ISO fechada (seg–dom) contra a anterior: `## Commits`, `## Pull requests`, `## Releases`, `## Atenção`. Saídas: **copiar markdown** (o botão vira **copiado!**) e **baixar .md** (grava `resumo-<weekKey>.md`). O relatório é do time inteiro para a reunião semanal, por isso ignora os filtros da sidebar e sempre exclui bots.

## Build estático

A interface só lê os dados coletados. No `pnpm build`, `/setup`, `/settings`, os botões de coleta e o editor de `/teams` não existem. Ajuste identidades e times sob `pnpm dev`, recolete com `pnpm collect` e só então publique, conforme [Publicando o build estático](./publishing.md).
