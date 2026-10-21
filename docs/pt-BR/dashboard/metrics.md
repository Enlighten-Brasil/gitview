---
title: Glossário de métricas
description: "Fórmula, janela e limiar de cada métrica do dashboard: commits, linhas, PRs, reviews e releases."
---

# Glossário de métricas

Cada número do dashboard tem fórmula, janela e leitura. O escopo de filtro por rota e a lista de janelas fixas estão em [Regras dos filtros](./filters.md); a origem dos dados, em [Pipeline](../architecture/pipeline.md). Se a doc e o código divergirem, o código vence.

## Tabela resumo

| Métrica | O que mede | Janela |
|---|---|---|
| Commits | commits sem merge ([Atividade](#atividade)) | filtro de período |
| Linhas adicionadas / removidas | linhas do numstat, sem gerados | filtro de período |
| Commits/dia ativo | ritmo por dia com commit | histórico completo |
| Dias ativos | dias distintos com ≥1 commit | histórico completo |
| Streak | dias consecutivos com commit | histórico completo |
| Heatmap de horas | commits por dia da semana × hora | período (máx. 24 meses) |
| Tipos de commit | mix de conventional commits | filtro de período |
| Ritmo | 4 semanas contra as 8 anteriores | fixa |
| Envelhecimento de PR | dias desde a abertura do PR | agora |
| Cycle time | mediana de criação → merge | período; tendência fixa |
| Reviews por dev | reviews de terceiros | filtro de período |
| Concentração de review | participação do top reviewer | filtro de período |
| Merge sem review | % de merges sem review de terceiros | filtro de período |
| PRs abertos | PRs abertos na última coleta | agora |
| Dias desde a última release | dias desde a tag mais nova | marcos |
| Cadência de release | tags por mês | fixa: 12 meses |
| Commits por release | commits entre duas tags | marcos |
| Commits não liberados | commits depois da tag mais nova | agora |
| Fora do horário | fatia de fim de semana e madrugada | fixa: 8 semanas, ou período |
| Inatividade | dias desde o último commit | até hoje, sem filtros |
| Fix hotspots | % de commits `fix` por repo | filtro de período |
| Bus factor | participação do autor principal | filtro de período |
| Gargalo de review | participação do top reviewer | filtro de período |
| Weekly Champions | evolução contra a própria base | semana ISO no período |
| Delta dos cards | % contra a janela anterior | omitido em range custom e **Tudo** |

- Janela **fixa**, **agora**, **marcos** ou **histórico completo**: ignora o período de propósito e diz isso no rótulo, mas respeita repos, devs e bots. Só inatividade ignora a sidebar inteira; releases seguem a seleção de repos.
- Datas são gravadas em UTC ISO com milissegundos e os buckets de tempo (mês, dia, semana ISO, fim de semana, madrugada, heatmap) saem de `GITVIEW_TIMEZONE`, default `America/Sao_Paulo` ([Configuração](../configuration/env.md)).

## Atividade

**Commits**: uma linha de `git log --all --no-renames --no-merges --numstat` por repo, dentro da janela. Merges ficam fora de toda métrica, removidos por topologia e não por assunto: um single-parent com assunto "Merge" (squash ou pull regravado) conta, e a produção de um merge já aparece no PR. `pnpm clean && pnpm collect` aplica o filtro ao histórico já no banco. Commits com data ilegível saem de todos os buckets.

**Linhas adicionadas e removidas**: somas do `--numstat` por commit. Lockfiles e arquivos gerados são filtrados linha a linha no parse, nunca via pathspec: o commit conta, as linhas geradas dele não. `GITVIEW_EXCLUDE_PATHS` (CSV de globs) adiciona os seus padrões, com `/` casando o caminho inteiro e sem `/` casando só o nome do arquivo. A lista default está em [Coletores](../architecture/collectors.md).

**Dias ativos**: contagem de dias de calendário distintos com pelo menos um commit. **Commits/dia ativo**: `commits / max(diasAtivos, 1)`. As duas são totais históricos e aparecem com o sufixo `(total)` nas páginas de dev. Em `/devs/<nome>` com o escopo de trabalho recortado (`?scope=prod`/`progress`) e o dado portando os eixos `byScope` por autor (coletas a partir da issue #152), as duas leem o eixo do escopo selecionado e o sufixo `(total)` passa a marcar só o período; sem os eixos, o comportamento histórico se mantém (feature-detect na presença de `byScope`).

**Streak**: aritmética calendária pura sobre chaves de dia no fuso canônico, sem matemática de `Date` local, então DST e fuso da máquina não quebram a sequência. **streak** são os dias consecutivos que terminam no último dia ativo (quem está parado há 3 dias ainda mostra a sequência que acabou ali); **recorde** é a maior sequência de todos os tempos, exibida como `máx`. Desde a issue #152 o coletor roda a mesma aritmética por eixo de escopo: com o escopo recortado e `byScope` presente, o card de `/devs/<nome>` mostra a sequência e o recorde do eixo.

**Heatmap de horas** (**Frequência — dia da semana × hora**): commits por (autor, repo, mês, dia da semana, hora), com `0 = dom … 6 = sáb` e hora `0–23`. A agregação guarda no máximo 24 meses, então **Tudo** tem esse teto, e o período corta por mês.

**Tipos de commit**: o prefixo conventional do assunto (`type(scope)!: description`). Casos de `^([a-z]+)(\([^)]*\))?!?:` (case-insensitive) entre `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`, `build` e `ci` mantêm o nome; o resto vira `outros`. Os gráficos agrupam em `feat`, `fix`, `refactor`, `chore`, `outros`, então as demais categorias somem em `outros`; fix hotspots conta os `fix` crus. A agregação é mensal por (mês, repo, autor, tipo).

## Ritmo

**Ritmo — últimas 4 semanas vs 8 anteriores**: `ratio = (commits das últimas 4 semanas ISO / 4) / (commits das 8 semanas ISO anteriores / 8)`, `null` quando a média anterior é 0. As semanas são de calendário, ancoradas em hoje: semana sem dados conta 0 e a janela nunca estica. Entra na lista quem tem média anterior `≥ 2` ou commits recentes `> 0`. **abaixo do ritmo** em `ratio ≤ 0.5`; **acelerando** em `ratio ≥ 1.5`.

## Pull requests

Vêm da coleta do GitHub: todo PR aberto mais os mergeados dos últimos 400 dias. Login do GitHub vira nome canônico do dev antes de qualquer filtro.

**Envelhecimento de PR**: `dias desde createdAt` em dias inteiros até agora, com 0 exibido como "hoje". **PRs abertos — mais antigos primeiro** pinta a idade de âmbar acima de 3 dias e vermelho acima de 7. **PRs parados — abertos há 14+ dias** lista os 5 mais antigos com idade `≥ 14` (`mostrando N de M`; a lista completa está no painel **PRs abertos — mais antigos primeiro**) e o badge vira erro com 5 ou mais parados.

**Cycle time**: `cycleHours = (mergedAt - createdAt) / 3_600_000`. O card **cycle time mediano** nomeia o corte: **cycle time mediano (corte por dia)** (`/prs` e a página de time) é a mediana sobre os PRs mergeados dentro da janela exata do filtro em dias, enquanto **cycle time mediano (PRs do mês)** (detalhe de dev e de repo) cobre meses inteiros tocados pela janela — o mesmo período, portanto, mostra números diferentes por página. Contagem par usa a média dos dois valores centrais e sem PR o resultado é 0. Por repo (**Cycle time mediano por repo (criação → merge, corte por dia)**, corte por dia), só entram os com 3 ou mais PRs mergeados na janela. A **Tendência de cycle time** usa os últimos 6 meses: uma mediana por mês, meses sem PR pulados, `subindo` quando os últimos 3 meses com dados são estritamente crescentes, e repos com menos de 3 PRs na janela ficam fora.

**Reviews por dev e concentração por repo**: conta as reviews de PRs mergeados no período, sem self-review e sem bots. **Reviews por dev** divide em total, `APPROVED` e `CHANGES_REQUESTED`. **Concentração por repo** é `reviews do top reviewer / reviews de terceiros do período`, ordenada por esse valor.

**Merge sem review**: PR sem nenhuma review de terceiros não-bot; `round(sem review / mergeados no período × 100)`. `≥ 10%` é atenção e `≥ 20%` é crítico, nos cards de resumo e na faixa de alertas.

## Releases

Vêm da coleta de releases: `git tag` local para cobertura e API REST do GitHub para nomes e notas. Tags são marcos, então os painéis ignoram o período e seguem a seleção de repos. Commits são atribuídos a tags por comparação de timestamp, nunca por texto.

- **Dias desde a última release**: dias desde a tag mais nova, `null` sem tags, warning aos 30+ dias.
- **Cadência de release**: tags com data nos últimos 12 meses divididas por 12, exibida como `X/mês`.
- **Commits por release**: commits com timestamp em `(tag anterior, esta tag]`; cada linha de tag mostra a própria contagem.
- **Commits não liberados**: commits depois da tag mais nova; badge `N não liberados` a partir de 20, vermelho a partir de 50.

## Fora do horário

Commits de `weekend` (sáb e dom) e `night` (22h–6h) no fuso canônico: `offHoursPct = (weekend + night) / total`. Uma linha só aparece com `total > 0` e pelo menos um commit fora do horário.

- **Modo 8 semanas**: janela fixa. Mostra `fds ativos (últ. 4)`, quantas das últimas 4 linhas semanais da janela têm commit de fim de semana, contado por autor × repo × semana (o mesmo fim de semana em dois repos conta duas vezes).
- **Modo período**: segue a sidebar, ignora devs com menos de 20 commits no período e julga só por porcentagem.
- Status: **padrão** com `offHoursPct ≥ 25%` ou `fds ativos (últ. 4) ≥ 3`; **atenção** com `≥ 15%`, elevado para atenção no modo 8 semanas quando há 5+ commits fora do horário; **pontual** abaixo.
- No resumo semanal, o dev é sinalizado com `≥ 25%` e pelo menos 5 commits na semana.

## Thresholds de saúde

Cada card da página Saúde documenta os próprios valores no rodapé.

| Card | Métrica | Atenção | Crítico |
|---|---|---|---|
| Ritmo | ratio contra a média anterior | `≤ 0.5×` | `≤ 0.5×` vira erro no painel |
| PRs parados | idade do PR aberto | `≥ 14` dias | badge de erro com `≥ 5` parados |
| Idade de PR (tabela) | idade do PR aberto | `> 3` dias | `> 7` dias |
| Merge sem review | % sem review de terceiros | `≥ 10%` | `≥ 20%` |
| Inatividade (dev) | dias desde o último commit | `≥ 21` dias | `≥ 60` dias |
| Inatividade (repo) | dias desde o último commit | `≥ 30` dias | `≥ 90` dias |
| Fix hotspots | % de commits `fix` | `≥ 25%` | `≥ 35%` |
| Commits não liberados | commits desde a última tag | `≥ 20` | `≥ 50` |
| Fora do horário | fatia de fds e madrugada | `≥ 15%` | `≥ 25%` ou 3+ fins de semana |
| Releases | dias desde a última tag | `≥ 30` dias | — |
| Bus factor | participação do autor principal | `≥ 50%` | ver nota abaixo |
| Gargalo de review | participação do top reviewer | `≥ 50%` | `≥ 70%` |

- **Bus factor** é crítico com `≥ 70%` e no máximo 2 devs ativos, ou com `≥ 50%` quando o mesmo autor também faz `≥ 70%` das reviews do repo (ponto cego de revisão, que exige pelo menos 5 reviews no repo).
- **Amostra mínima**: fix hotspots ignora repos com menos de 20 commits no período; bus factor, menos de 10 commits; gargalo de review, menos de 5 reviews.
- **Inatividade** é a única métrica medida até hoje, com a sidebar ignorada: todos os repos, todos os devs, bots fora da lista. Os dias são inteiros: `floor((agora − último commit) / 86 400 000)`.
- **Acelerando** (`ratio ≥ 1.5`) é verde e não é tier de risco; a faixa de alertas usa a mesma queda de `≤ 0.5×`. Cada linha de PR parado vira erro com `≥ 30` dias.

## Weekly Champions

**Campeão da semana — maior evolução**, para cada semana ISO do período: `ratio = commits / (média das 8 semanas de calendário anteriores dentro do período + 1)`, com candidatos a partir de 3 commits na semana. Vence o maior `ratio`; empate se quebra por mais commits e depois por nome. Semana vazia conta 0 e não estica a janela; semanas anteriores ao início do período não contam; uma semana sem anterior dentro do período fica fora. **vitórias (período)** conta os títulos por dev na janela.

## Delta dos cards

Os cards de resumo comparam com a janela anterior equivalente: num preset de 6M, os 6 meses imediatamente antes do corte, com os mesmos filtros de repo, dev e bot.

- `pct = round((atual − anterior) / anterior × 100)`; variação absoluta de até 2% aparece como flat. Omitido em range custom, em **Tudo** e quando a janela anterior soma zero.
- Cor: commits, devs e repos subindo são verde, caindo são vermelho; linhas são neutras. Tooltip: `vs o mês anterior` no preset de 1M, `vs os N meses anteriores` nos demais.
