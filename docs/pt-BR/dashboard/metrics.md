---
title: Glossário de métricas
description: Fórmula exata e janela de cálculo de cada métrica do dashboard do gitview — commits, PRs, releases, thresholds de saúde e deltas.
---

# Glossário de métricas

Todo número do dashboard tem uma fórmula e uma janela. Esta página declara as duas, direto dos coletores e do `src/`, para você confiar num card sem ler o código. Quando documentação e código divergirem, o código vence.

## Tabela resumo

| Métrica | O que mede | Janela |
|---|---|---|
| Commits | commits sem merge (ver [Atividade](#atividade)) | filtro de período |
| Linhas adicionadas / removidas | linhas do numstat, arquivos gerados excluídos | filtro de período |
| Commits/dia ativo | ritmo por dia com commits | histórico completo (`(total)`) |
| Dias ativos | dias distintos com ≥1 commit | histórico completo (`(total)`) |
| Streak | dias consecutivos com commit | histórico completo (`(total)`) |
| Heatmap de horas | commits por dia da semana × hora | filtro de período (máx. 24 meses) |
| Tipos de commit | mix de conventional commits por mês/repo | filtro de período |
| Ritmo | últimas 4 semanas vs as 8 anteriores | fixa: 4 vs 8 semanas |
| Envelhecimento de PR | dias desde o `createdAt` dos PRs abertos | "agora" |
| Cycle time | mediana criação → merge | filtro de período (tendência: fixa de 6 meses) |
| Reviews por dev | reviews de terceiros feitas | filtro de período |
| Concentração de review | participação do top reviewer por repo | filtro de período |
| Merge sem review | % de merges sem review de terceiros | filtro de período |
| PRs abertos | PRs abertos na hora da coleta | "agora" |
| Dias desde a última release | dias desde a tag mais nova | marcos (ignoram a sidebar) |
| Cadência de release | tags por mês | fixa: últimos 12 meses |
| Commits por release | commits entre tags | marcos (ignoram a sidebar) |
| Commits não liberados | commits desde a tag mais nova | "agora" |
| Fora do horário | fatia de fim de semana + madrugada | fixa: 8 semanas, ou período |
| Inatividade | dias desde o último commit | até hoje (ignora todos os filtros) |
| Fix hotspots | % de commits `fix` por repo | filtro de período |
| Bus factor | participação do autor principal por repo | filtro de período |
| Gargalo de review | participação do top reviewer por repo | filtro de período |
| Weekly Champions | evolução vs a própria linha de base | por semana ISO no período |
| Delta dos cards | % de mudança vs a janela anterior | omitido em range custom e **Tudo** |

Existem dois tipos de janela. **Filtro de período** segue a sidebar (presets 1/3/6/12/24M ou **Tudo**, mais um range custom `dateFrom`/`dateTo` que corta por mês inteiro — as agregações são mensais/semanais, ver [Filtros](./filters.md)). **Janelas fixas** ignoram o filtro de período de propósito e dizem isso no rodapé do card; elas ainda respeitam os filtros de repo, dev e bot. Dois painéis ignoram a sidebar inteira: releases (tags são marcos do repo) e inatividade (medida até hoje). Timestamps são gravados em UTC ISO com milissegundos; os buckets de tempo são calculados em `GITVIEW_TIMEZONE` (default `America/Sao_Paulo`).

## Atividade

### Commits

Um commit é uma linha do `git log --all --no-renames --no-merges --numstat` por repo. **Commits de merge ficam fora de toda métrica**: são removidos na chamada do `git log` por topologia (`--no-merges`), não por assunto — um commit single-parent cujo assunto diz "Merge" (squash ou pull regravado) ainda conta. Commits com data ilegível saem de todos os buckets.

:::info Por que merges não contam?
Commits de merge carregavam diffs `+0−0`, mas uma fatia grande do histórico escaneado era de commits `Merge …`, inflando commits/dia, ritmo e streaks. A "produção" de um merge já aparece no PR. Como a regra mora no coletor, histórico antigo já no banco mantém seus merges — rode `pnpm clean && pnpm collect` para aplicá-la retroativamente. Ver [issue #7](https://github.com/Enlighten-Brasil/gitview/issues/7).
:::

### Linhas adicionadas / removidas

Adições e deleções vêm da saída do `--numstat`, somadas por commit. Linhas de lockfiles e arquivos gerados são filtradas **durante o parse do numstat** (nunca via pathspec — isso derrubaria commits inteiros): o commit conta, as linhas geradas dele não. A lista default (`DEFAULT_EXCLUDE_PATHS`) cobre lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, `bun.lock`, `bun.lockb`, `Cargo.lock`, `composer.lock`, `Gemfile.lock`, `poetry.lock`, `Pipfile.lock`, `pubspec.lock`, `Package.resolved`, `go.sum`) e assets gerados (`*.min.js`, `*.min.css`, `*.min.map`, `*.snap`, `*.generated.ts`, `*.generated.js`, `*.designer.cs`). O `GITVIEW_EXCLUDE_PATHS` (CSV de globs) adiciona os seus padrões. Um padrão com `/` casa o caminho inteiro em qualquer profundidade; sem `/` casa o basename; o matching é case-sensitive como gitignore.

### Commits/dia ativo e dias ativos

```ts
commitsPerActiveDay = commits / Math.max(activeDays, 1)
```

`activeDays` é a contagem de dias de calendário distintos com pelo menos um commit. As duas métricas são totais históricos — nas páginas de dev elas carregam o sufixo ` (total)` quando um filtro de período está ativo, porque ficam intencionalmente fora do filtro de período.

### Streak

Streaks usam aritmética calendária pura sobre chaves de dia no fuso canônico (sem matemática de `Date` local, sem divisão de tempo decorrido — DST ou fuso da máquina não quebram uma sequência):

- **streak** (`streak`): dias consecutivos terminando no último dia ativo do dev. Um dev cujo último commit foi há 3 dias ainda mostra a sequência que terminou ali.
- **recorde** (`longestStreak`): a maior sequência consecutiva de todos os tempos ("máx" no ranking).

### Heatmap de horas

O heatmap **Frequência — dia da semana × hora** agrega linhas de `stats.heatmap`: commits por (autor, repo, mês, dia da semana, hora), com dia da semana `0 = dom … 6 = sáb` e hora `0–23`. O coletor guarda no máximo os últimos 24 meses de linhas de heatmap, então mesmo **Tudo** mostra no máximo 24 meses aqui. O filtro de período se aplica em granularidade de mês.

:::info Por que existe um fuso canônico?
Todos os buckets de tempo — mês, dia, semana ISO, fim de semana, madrugada, heatmap — são calculados em `GITVIEW_TIMEZONE` (default `America/Sao_Paulo`) via `Intl`, nunca no relógio da máquina que coleta. O mesmo banco produz agregados byte-idênticos em qualquer máquina, e UTC sozinho não modela a "madrugada" de ninguém na prática. Antes da [issue #8](https://github.com/Enlighten-Brasil/gitview/issues/8), a chave de semana ISO usava UTC enquanto os outros buckets usavam o fuso local — o mesmo commit podia cair em semanas diferentes dependendo de onde você coletava.
:::

### Tipos de commit

O tipo é o prefixo de conventional commit do assunto: `type(scope)!: description`. Qualquer coisa que case `^([a-z]+)(\([^)]*\))?!?:` (case-insensitive) com `type` em `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`, `build`, `ci` mantém o nome; todo o resto vira `outros`. Os gráficos (**Tipos de commit por mês (feat × fix × ...)**, **Mix por repo (% — ordenado por fix)**) agrupam em cinco categorias — `feat`, `fix`, `refactor`, `chore`, `outros` — então `docs`/`test`/`perf`/`style`/`build`/`ci` aparecem dentro de `outros`. A métrica de fix hotspot conta commits `fix` crus. A agregação é mensal por (mês, repo, autor, tipo) em `stats.json#monthlyTypes`.

## Ritmo

**Ritmo — últimas 4 semanas vs 8 anteriores** compara as últimas 4 semanas ISO com a média semanal das 8 anteriores:

```ts
recent  = commits in the last 4 ISO weeks
prevAvg = (commits in the previous 8 ISO weeks) / 8
ratio   = (recent / 4) / prevAvg   // null quando prevAvg = 0
```

As janelas são semanas de calendário ancoradas em hoje (uma semana sem dados conta 0 — a janela nunca estica). Só aparecem devs com `prevAvg ≥ 2` ou `recent > 0`. A janela é fixa: ignora o filtro de período mas respeita repos, devs e bots. Alertas: **abaixo do ritmo** quando `ratio ≤ 0.5`, **acelerando** quando `ratio ≥ 1.5` (lista verde, positiva — não é tier de risco).

## Pull requests

Todos os dados de PR vêm do `github.json` (GraphQL: todo PR OPEN mais os MERGED dos últimos 400 dias). Autores de PR são resolvidos de login do GitHub para o nome canônico do dev antes de qualquer filtro.

### Envelhecimento (PRs abertos)

A idade é `daysSince(createdAt)` — dias inteiros decorridos até agora (0 aparece como "hoje"). **PRs abertos — mais antigos primeiro** ordena do mais antigo; a idade é pintada de âmbar acima de 3 dias e vermelha acima de 7 dias. **PRs parados — abertos há 14+ dias** lista os 5 PRs abertos mais antigos com `age ≥ 14` dias (`mostrando N de M`; a lista completa fica na aba Pull requests); o badge vira erro com 5 ou mais PRs parados, e cada linha listada fica vermelha em `age ≥ 30` dias. PRs abertos são métrica de "agora": o filtro de período nunca se aplica a eles.

### Cycle time

```ts
cycleHours = (mergedAt - createdAt) / 3_600_000
```

O card **cycle time mediano** é a mediana de `cycleHours` sobre os PRs mergeados no período filtrado (contagem par → média dos dois valores centrais; sem PRs → 0). Por repo, só repos com 3 ou mais PRs mergeados no período ganham mediana. O gráfico de tendência (`mediana do cycle time (criação → merge) por mês, com (n PRs)`) usa uma **janela fixa de 6 meses** (ignora o filtro de período, respeita repos/devs/bots): uma mediana por mês, meses sem PRs pulados, e `subindo` significa que os últimos 3 meses com dados são estritamente crescentes. Repos com menos de 3 PRs na janela são descartados.

### Reviews por dev e concentração por repo

As reviews contadas são as de PRs mergeados no período filtrado, excluindo self-review (do próprio autor do PR) e reviews de bot. **Reviews por dev** as divide em total, `APPROVED` e `CHANGES_REQUESTED`. **Concentração por repo** (`reviewShareByRepo`) calcula `topShare = topReviewerCount / thirdPartyReviewsInThePeriod` e ordena por ela.

### Merge sem review

Um PR conta como "mergeado sem review" quando nenhuma review vem de outra pessoa não-bot. A métrica é `round(withoutReview / mergedInThePeriod * 100)` — o card **Merge sem review — período filtrado**. Thresholds: ≥10% é atenção, ≥20% é alto (mesmos valores nos cards de resumo e na faixa de alertas).

## Releases

Os dados de release vêm do `releases.json` (`git tag` local para cobertura, API REST do GitHub para nomes e notas). Tags são marcos: os painéis de release ignoram a sidebar inteira — o rodapé da grade diz `marcos — ignoram o filtro de período`. Commits são atribuídos a tags por **comparação de timestamp, nunca de texto** (offsets de UTC mistos atribuíam commits à tag errada quando comparados como strings).

- **Dias desde a última release**: `daysSince(tags[0].date)` — as tags são gravadas da mais nova para a mais antiga; `null` quando o repo não tem tags. Aos 30+ dias o rótulo vira warning (release "atrasada").
- **Cadência de release**: tags com data nos últimos 12 meses ÷ 12, exibido como `X/mês`.
- **Commits por release**: commits cujo timestamp cai em `(tag anterior, esta tag]` (timestamps ascendentes, two-pointer). Cada linha de tag mostra a própria contagem.
- **Commits não liberados** (`unreleased`): commits depois da tag mais nova. O badge `N não liberados` aparece a partir de ≥20 (atenção) e fica vermelho em ≥50.

## Fora do horário / burnout

**Fora do horário** conta commits de `weekend` (sáb/dom) e `night` (22h–6h) — ambos no fuso canônico — e mostra `offHoursPct = (weekend + night) / total`. O card tem dois modos:

- **8 semanas** — janela fixa de 8 semanas (ignora o filtro de período). Também mostra `fds ativos (últ. 4)`: quantas das últimas 4 linhas semanais da janela trazem commit de fim de semana — contado por autor × repo × semana, então o mesmo fds em dois repos conta duas vezes. Linhas precisam de `total > 0` e pelo menos um commit de fim de semana/madrugada.
- **período** (rotulado com o range atual) — segue o filtro da sidebar. Devs com menos de 20 commits no período são ignorados (`OFF_HOURS_MIN_COMMITS`); como no modo 8 semanas, a linha só aparece com pelo menos um commit de fim de semana/madrugada.

Faixas de status: **padrão** com `offHoursPct ≥ 25%` ou `fds ativos (últ. 4) ≥ 3`; **atenção** com `≥ 15%` — no modo 8 semanas, ter 5 ou mais commits de fim de semana/madrugada eleva o piso para atenção mesmo abaixo de 15%; **pontual** abaixo. O modo período julga só por porcentagem. No resumo semanal, um dev é sinalizado com `≥ 25%` fora do horário e pelo menos 5 commits naquela semana.

## Thresholds de saúde

Cada card de `/health` documenta os próprios thresholds no rodapé. A maioria dos valores vem de `src/thresholds.ts` (centralizado desde a issue #26); os tiers de bus factor e de gargalo de review ainda são escritos inline nos próprios painéis. Os valores:

| Card | Métrica | Atenção | Crítico |
|---|---|---|---|
| Ritmo (`PaceAlert`, `AlertStrip`) | ratio vs média anterior | queda `≤ 0.5×` (warning na faixa) | `≤ 0.5×` é a lista em erro no painel; `≥ 1.5×` mostra **acelerando** em verde — positivo, não é tier de risco |
| PRs parados (`PrStaleAlert`) | idade dos PRs abertos | `≥ 14` dias | badge em erro com `≥ 5` PRs parados; linha em erro com `≥ 30` dias |
| Idade de PR (`PrOpenTable`) | idade do PR aberto | `> 3` dias | `> 7` dias |
| Merge sem review (`ReviewCoverage`, `PrSummaryCards`) | % mergeado sem review | `≥ 10%` | `≥ 20%` |
| Inatividade — dev (`InactiveWatch`) | dias desde o último commit | `≥ 21` dias | `≥ 60` dias |
| Inatividade — repo (`InactiveWatch`) | dias desde o último commit | `≥ 30` dias | `≥ 90` dias |
| Fix hotspots (`FixHotspots`, `RepoTable`) | % de commits `fix` | `≥ 25%` | `≥ 35%` |
| Commits não liberados (`RepoTable`, `RepoReleasesGrid`) | commits desde a última tag | `≥ 20` | `≥ 50` |
| Fora do horário (`OffHoursPanel`) | fatia fora do horário | `≥ 15%` (ou 5+ commits de fds/madrugada no modo 8 semanas) | `≥ 25%` ou 3+ fins de semana ativos |
| Releases (`RepoReleasesGrid`) | dias desde a última tag | `≥ 30` dias | — |
| Bus factor (`BusFactor`) | participação do autor principal | `≥ 50%` | `≥ 70%` com ≤2 devs ativos, ou autor principal `≥ 50%` que também faz `≥ 70%` das reviews |
| Gargalo de review (`ReviewBottleneck`) | participação do top reviewer | `≥ 50%` | `≥ 70%` |

Travas de tamanho de amostra (amostras pequenas são ruído): fix hotspots ignoram repos com menos de 20 commits no período; bus factor ignora repos com menos de 10 commits; gargalo de review ignora repos com menos de 5 reviews. O "ponto cego" do bus factor (o autor principal também domina as reviews) precisa de pelo menos 5 reviews no repo.

A inatividade é a única métrica medida **até hoje, ignorando todos os filtros da sidebar** (todos os repos, todos os devs, bots excluídos da lista de devs) — alguém quieto há semanas deve aparecer não importa o que você filtrou. `daysSince` é em dias inteiros: `floor((now − lastCommit) / 86 400 000)`.

## Weekly Champions

**Campeão da semana — maior evolução** premia melhora, não volume. Para cada semana ISO no período filtrado:

```ts
// candidatos: devs com >= 3 commits na semana (MIN_WEEK_COMMITS)
// linha de base: as 8 semanas ISO de calendário anteriores, restritas ao período
ratio = commits / (baselineMean + 1)   // baselineMean = soma / semanasNaJanela
```

O vencedor é o maior ratio; empates quebram por mais commits, depois por nome. A linha de base usa semanas de **calendário** — uma semana vazia conta 0 em vez de esticar a janela — e só semanas dentro do período filtrado contam (`semanas anteriores ao início do período não contam`); uma semana sem semana anterior no período sai do ranking. A tabela **vitórias (período)** conta títulos por dev ao longo do período.

:::info Por que premiar evolução?
Volume puro dava 82% das semanas para o mesmo dev e premiava picotar commits. A fórmula `commits ÷ (média das 8 semanas anteriores + 1)` premia ritmo: o `+1` no denominador dá 2× para quem começa do zero, então voltar de férias ganha uma semana, não o quadro inteiro. O piso de 3 commits mata o ruído de médias minúsculas. Ver [issue #10](https://github.com/Enlighten-Brasil/gitview/issues/10).
:::

## Deltas dos cards

Os cards de resumo (commits, `linhas +`, `linhas −`, `devs ativos`, `repos ativos`) mostram um delta contra a **janela anterior equivalente**: para um preset de 6M, os 6 meses imediatamente antes do corte. A janela de comparação é construída com os mesmos filtros de repo/dev/bot da atual.

- O delta é **omitido** em range custom e em **Tudo** — não existe janela comparável (`previousTotals` retorna `null`) — e também quando a janela anterior soma zero (não há por que dividir).
- `pct = round((current − previous) / previous * 100)`; mudança absoluta de até 2% aparece como flat (`DELTA_FLAT_PCT`).
- Cor: commits/devs/repos subindo é verde, caindo é vermelho; contagens de linhas são neutras.
- Tooltip: `vs o mês anterior` para preset de 1M, `vs os N meses anteriores` nos demais.

## Próximos passos

- [Pipeline](../architecture/pipeline.md) — de onde vêm os dados de cada métrica (coletores, JSONs, invariantes).
- [Desenvolvimento](../contributing/development.md) — como rodar os coletores e mudar thresholds com segurança.
