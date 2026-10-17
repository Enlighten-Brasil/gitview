---
title: Pipeline
description: Como o gitview transforma o histórico git e os dados da API do GitHub nos cinco JSONs que o dashboard estático lê.
---

# Pipeline

O gitview transforma o histórico git e os dados da API do GitHub em cinco arquivos JSON em `public/data/`. O frontend lê só esses arquivos — nada é recalculado do git no navegador. Esta página mapeia o fluxo inteiro e explica cada seta.

## O fluxo completo

```text
git log --all --no-merges --numstat        API GraphQL do GitHub          git tag + API REST do GitHub
  (por repo, pool de 4)                     (token: .env / gh)             (notas + datas das tags)
        │                                        │                              │
        ▼                                        ▼                              ▼
data/gitview.db                            public/data/github.json       public/data/releases.json
(node:sqlite, incremental)                 (PRs + reviews)               (tags + notas de release)
        │
        │  agrega (buckets em GITVIEW_TIMEZONE)
        ├──────────────────────────────► public/data/stats.json   (agregados do dashboard)
        └──────────────────────────────► public/data/commits.json (100 últimos commits/autor)

team.local.json + stats.json + github.json
        │
        └──────────────────────────────► public/data/team.json    (devs + times + candidatos)

public/data/*.json ──► check-data.ts ──► gate: shape + invariantes (erro = coleta falha)
public/data/*.json ──► frontend 100% estático (Vue 3 + Vite + ECharts) — lê só public/data/
```

`data/gitview.db` e `public/data/*.json` são artefatos gitignored — sempre regenerados pelos coletores, nunca commitados.

## O que cada seta faz

### git log → data/gitview.db

O `collect.ts` roda `git log --all --no-merges --numstat` em cada repo (streaming), normaliza cada commit — data em UTC ISO, nome canônico do autor via aliases — e insere no SQLite (`node:sqlite`, tabela `commits`, chave primária `(repo, hash)`). O insert é `INSERT OR IGNORE`, então re-rodar a coleta nunca duplica linhas.

:::info Por que merges não contam?
Commits de merge trazem diff `+0−0` mas inflam commits/dia, ritmo e streaks — 17,6% do histórico escaneado era `Merge …`. A "produção" do merge já está no PR. Por isso o `collect.ts` remove os merges na chamada do `git log` por topologia (`--no-merges`), não por assunto: um commit single-parent com assunto "Merge" (squash/pull regravado) ainda conta. Histórico antigo já gravado no banco mantém os merges — rode `pnpm clean && pnpm collect` para aplicar a regra retroativamente. Ver [issue #7](https://github.com/Enlighten-Brasil/gitview/issues/7).
:::

### data/gitview.db → stats.json + commits.json

O `collect.ts` agrega a tabela em buckets de tempo (semana, mês, heatmap, tipos de commit) e rollups por autor/por repo, gravando o `stats.json`; o `commits.json` recebe os 100 últimos commits de cada autor, mais recente primeiro. A agregação roda em `GITVIEW_TIMEZONE` — mais detalhes em [Coletores](./collectors.md).

### API GraphQL do GitHub → github.json

O `collect-github.ts` busca todos os PRs OPEN mais os MERGED dos últimos 400 dias, com reviews inline (1 request por página de 100 PRs), e mapeia logins do GitHub para nomes canônicos de dev. A auth vem de `GITVIEW_GITHUB_TOKEN` (`.env` ou shell) com o `gh auth token` como ponte opcional.

### git tag + API REST do GitHub → releases.json

O `collect-releases.ts` lê as tags locais (`git tag`) para cobertura universal e as enriquece com nome, notas e URL da API REST do GitHub. A contagem de commits por release vem do `data/gitview.db` e compara timestamps, nunca texto.

### team.local.json + stats/github → team.json

O `collect-team.ts` mescla o seu `team.local.json` (perfis de dev, times, bots) com as identidades vistas nos dados coletados, produzindo o `team.json` — devs, times e candidatos sem mapeamento. Ele roda por último porque lê o `stats.json` e o `github.json` gerados antes dele.

### check-data.ts: o gate

O `check-data.ts` lê os cinco JSONs e checa estrutura mais invariantes entre arquivos (ex.: as somas por autor, por repo e mensal precisam ser iguais a `totals.commits`). Qualquer erro sai com exit code 1 — a coleta falha e você corrige os dados antes de confiar no dashboard. Avisos de qualidade imprimem mas nunca bloqueiam.

## O que "incremental" significa

Re-rodar a coleta é barato por design:

- **Lado git**: cada repo recebe `--since=<watermark>` na chamada do `git log`, onde o watermark é a data do commit mais novo já gravado no banco para aquele repo menos uma margem de 7 dias (cobre commits com committer date antiga mergeados depois do watermark). O `INSERT OR IGNORE` torna a sobreposição inócua. `--full` ignora o watermark e re-escaneia tudo; `--reaggregate` pula o git por completo e só re-aplica aliases e re-exporta os JSONs.
- **Lado GitHub**: o `collect-github.ts` refaz o fetch só dos PRs atualizados desde a última coleta (margem de 1 dia) e mescla com o `github.json` anterior. PRs mergeados são preservados; a lista fresca de OPEN é a verdade. `--full` ignora o cache no fetch (mas mantém o arquivo anterior como rede de segurança para repos que falham).

## Onde a UI entra

O frontend é 100% estático: `pnpm build` gera um `dist` que só busca os JSONs em `public/data/`. As partes interativas vivem só no dev server:

- O wizard de configuração (`/setup/*`) e as telas de Configurações (`/settings`) usam plugins Vite com `apply: 'serve'` — no build estático essas rotas e os endpoints delas não existem.
- Os endpoints `/__*` (`/__collect`, `/__setup/*`, `/__auth/*`, `/__team/*`, `/__clean`) são dev only. O botão de coleta ↻ na navbar só renderiza em dev.

Então o deploy de produção é: rodar os coletores onde você quiser dados mais frescos, publicar `dist` + `public/data/`. Sem servidor, sem banco, sem token na máquina que serve o dashboard.

## Próximos passos

- [Coletores](./collectors.md) — modos, filtros e o gate de validação em detalhe.
- [Modelo de dados](./data-model.md) — o shape exato dos cinco JSONs.
