---
title: Coletores
description: Referência dos cinco coletores — saídas, fontes, modos incrementais, filtros e o gate do check-data.
---

# Coletores

Os coletores de `scripts/` são o pipeline de dados inteiro do gitview: leem os remotes git e a API do GitHub e gravam os cinco JSONs em `public/data/`. Esta página é a referência — o que cada um escreve, como funcionam os modos incrementais e o que nunca entra nas métricas.

## Resumo

| script | saída | fonte |
|---|---|---|
| `collect.ts` | `stats.json` (agregados) + `commits.json` (100 últimos commits/autor) | `git log --all --no-merges --numstat` → SQLite (`data/gitview.db`, incremental) |
| `collect-github.ts` | `github.json` (PRs + reviews, mapa login→dev) | API GraphQL do GitHub (token no `.env` ou `gh auth token`) |
| `collect-releases.ts` | `releases.json` (tags, commits por tag, não liberados, notas) | `git tag` + API REST do GitHub |
| `collect-team.ts` | `team.json` (devs, times, candidatos sem mapeamento) | `team.local.json` + `stats.json`/`github.json` já gerados |
| `check-data.ts` | — (só valida, exit 1 em erro) | os 5 JSONs de `public/data/` |

O `pnpm collect` roda os quatro coletores em sequência e o `check-data.ts` no fim. Todo coletor que percorre repos os processa em paralelo com pool de 4. O mapeamento de identidade é explícito: logins do GitHub e e-mails de commit resolvem para nomes canônicos via `devProfiles` no `team.local.json` (merge em `scripts/lib/team.ts`), nunca por matching aproximado.

## Modos do collect.ts

O coletor do git é incremental por padrão. Três botões controlam quanto trabalho o git faz:

- **Incremental (padrão)**: por repo, o `git log` recebe `--since=<watermark>`, onde o watermark é o `MAX(date)` das linhas daquele repo no banco menos uma margem de 7 dias (commits com committer date antiga mergeados depois do watermark ainda caem). Os inserts usam `INSERT OR IGNORE` em `(repo, hash)`, então a sobreposição é inócua e re-rodar nunca duplica.
- **`--full`**: ignora o watermark e re-escaneia o histórico completo de todos os repos.
- **`--reaggregate`**: pula o fetch dos clones gerenciados e o `git log` por completo — nada novo entra no banco. Só re-aplica aliases às linhas já gravadas (um dev renomeado é corrigido com `UPDATE ... WHERE email = ?`) e re-exporta os JSONs.

Duas coisas acontecem em toda execução, independente do modo: linhas de repos que saíram da seleção são podadas do banco (um repo que volta recebe scan completo, já que o watermark fica vazio), e colunas de data gravadas por versões antigas são migradas para o formato UTC atual (ver abaixo).

## A recoleta leve

O botão **salvar + recoletar** em `/teams` dispara `GET /__collect?light=1`, que roda:

1. `scripts/collect.ts --reaggregate` — re-aplica os aliases novos, sem git scan;
2. `scripts/collect-github.ts` — fetch incremental de PRs;
3. `scripts/collect-team.ts` — refaz o `team.json`;
4. `scripts/check-data.ts` — o gate.

Sem git scan e sem releases nesse caminho: edições de time mudam mapeamento de identidade, não histórico. Adicionar/remover um alias ainda precisa da recoleta leve para alcançar o `stats.json` — é por isso que o botão existe. (Remover um alias não renomeia linhas já gravadas no banco; só `pnpm clean` + `pnpm collect` reescreve essas.)

## Clones gerenciados: fetch e read-only

Os clones criados pelo wizard de configuração vivem em `data/repos/` (bare, gitignored). No início do `collect.ts`, cada clone gerenciado recebe `git fetch --all --prune --tags`, com três medidas de segurança:

- **Token nunca em disco**: o header de auth é injetado por processo via `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0` (`http.https://github.com/.extraheader` = `AUTHORIZATION: basic <base64 de x-access-token:token>`) — nada no argv, nada no config do clone. `GIT_TERMINAL_PROMPT=0` impede o git de pedir credencial.
- **`scrubPersistedToken`**: remove qualquer `extraheader` que versões antigas persistiram no config do clone (token em repouso). Idempotente, roda a cada coleta.
- **`denyPush`**: grava `remote.origin.pushurl=no-push`, então `git push` falha mesmo que a credencial permita escrita. Idempotente, aplicado no clone e a cada coleta. O gitview é read-only sobre os repos analisados.

Falha de fetch é tolerada: o coletor avisa e cai no cache local.

## Datas e fusos horários

Duas regras mantêm as datas comparáveis em qualquer lugar:

- **UTC ISO com milissegundos**: datas de commit são gravadas como `2026-10-08T18:05:13.000Z`. O formato `%aI` do git emite o offset original do autor, que quebrava comparação lexicográfica e ordenação quando gravado cru. Uma migração idempotente roda a cada abertura do banco e normaliza as linhas antigas.
- **Fuso canônico**: todo bucket de tempo (mês, dia, semana ISO, fim de semana, madrugada, heatmap) é calculado em `GITVIEW_TIMEZONE` (default `America/Sao_Paulo`) via `Intl.DateTimeFormat`, nunca no relógio da máquina que coleta. Um nome IANA inválido cai para o default com aviso. Streaks usam aritmética calendária pura sobre chaves de dia, então DST não quebra nada.

:::info Por que os buckets usam um fuso fixo?
O mesmo banco precisa produzir agregados byte-idênticos em qualquer máquina. Antes da [issue #8](https://github.com/Enlighten-Brasil/gitview/issues/8), a chave de semana ISO usava UTC enquanto os demais buckets usavam o fuso local da máquina — o mesmo commit podia cair em semanas diferentes dependendo de onde você coletava. O `GITVIEW_TIMEZONE` modela a "madrugada" e o "fim de semana" reais do time (UTC não modela os de ninguém), e um fuso só é o único jeito do heatmap, dos streaks e dos gráficos mensais concordarem entre si.
:::

Timestamps, não strings, decidem ordem onde importa: o `collect-releases.ts` conta commits por release comparando epochs, e o `check-data.ts` verifica que o `commits.json` está em ordem desc real.

## O que nunca entra nas métricas

- **Linhas de arquivos gerados**: lockfiles, bundles minificados e fontes geradas nunca contam nas métricas de linhas — mas os commits deles contam. O filtro roda **no parse do numstat** (por linha de arquivo), com a lista de globs em `DEFAULT_EXCLUDE_PATHS` (`scripts/lib/config.ts` — `pnpm-lock.yaml`, `*.min.js`, `*.snap`, `*.generated.ts`, …) mais o seu `GITVIEW_EXCLUDE_PATHS` (CSV de globs). Semântica dos globs: `*` casa dentro de um segmento do caminho, `**` em qualquer profundidade; padrão com `/` casa o caminho todo em qualquer profundidade, sem `/` só o basename; case-sensitive como `.gitignore`. Como a exclusão acontece na hora do insert, aplicar padrões novos a histórico antigo exige `pnpm clean && pnpm collect`.

:::info Por que excluir no numstat (e nunca com pathspec)?
Um pathspec do `git log` exclui *commits*: um commit que só mexe em `pnpm-lock.yaml` sumiria por inteiro, distorcendo contagens de commits, releases e heatmaps. Filtrar as linhas do numstat mantém o commit e derruba só as linhas geradas de `additions`/`deletions` — que é o que métrica de linha deve significar.
:::

- **Commits de merge**: removidos na chamada do `git log` por topologia (`--no-merges`), não por assunto. Commits single-parent com assunto começando por "Merge" (squash/pull regravado) ainda contam. Histórico gravado antes dessa regra mantém os merges — `pnpm clean && pnpm collect` aplica a regra retroativamente. O racional está na [página do pipeline](./pipeline.md) (issue #7).
- **Linhas com data quebrada**: uma linha que o parser não consegue datar sai de todos os buckets, e o coletor avisa com a contagem.

## check-data.ts: o gate de validação

O `pnpm check:data` roda sozinho e como último passo do `pnpm collect` e do `/__collect`. Ele só lê `public/data/*` e falha a coleta (exit 1) em qualquer erro de estrutura ou invariante.

**Asserts de estrutura**: cada arquivo existe, parseia para objeto no topo, tem `generatedAt` ISO válido, e suas listas carregam os campos que o frontend lê (checado no primeiro item).

**Invariantes** (principais):

- `stats.json`: Σ`perAuthor.commits` = Σ`perRepo.commits` = Σ`monthly.commits` = `totals.commits`; contagens não negativas; `heatmap.weekday` 0–6 e `hour` 0–23; `monthly.month` em `YYYY-MM`; `authors[].bot` booleano.
- `commits.json`: datas uniformemente UTC (terminando em `Z`), estritamente não crescentes por timestamp, `hash` em formato 7-hex.
- `github.json`: `state` é `OPEN` ou `MERGED`; `MERGED` tem `mergedAt` válido; sem duplicados `repo#number`; `state` de review na union fechada `APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING` (issue #42); nada `MERGED` mais velho que a janela de 400 dias — o gate aceita 401 dias, um dia de folga sobre `generatedAt` para não marcar um PR coletado exatamente no corte (issue #5).
- `releases.json`: tags em ordem decrescente de data, contagens de commits não negativas, e `unreleased` + Σ commits das tags = commits do repo no `stats.json`.
- `team.json`: nomes de dev únicos; todo membro de time é dev conhecido; `candidates[].kind` é `author` ou `login` e nunca ghost ou bot; sem logins duplicados por case dentro de um dev.

**Avisos não bloqueantes** (qualidade, imprimem mas nunca são fatais): membro de time que também é candidato sem mapeamento, dev humano sem aliases, `lastCommit` no futuro (relógio do autor errado — quebra o watermark incremental) e commits com assunto de merge e diff zero na amostra do `commits.json`.

## Comandos

```bash
pnpm collect            # os 4 coletores em sequência + check-data no fim
pnpm collect:github     # só PRs
pnpm collect:releases   # só releases
pnpm collect:team       # só time
pnpm check:data         # só a validação (shape + invariantes)
pnpm clean              # apaga banco + JSONs (tudo regenerável; clones só com flag)
```

## Próximos passos

- [Pipeline](./pipeline.md) — o fluxo que estes coletores implementam.
- [Modelo de dados](./data-model.md) — o shape exato que o check-data espera.
