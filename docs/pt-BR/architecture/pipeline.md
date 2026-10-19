---
title: Pipeline
description: Como o gitview transforma git e a API do GitHub nos seis JSONs de public/data que o frontend estático lê.
---

# Pipeline

O gitview produz seis JSONs em `public/data/`. O frontend lê só esses arquivos; nada do git é recalculado no navegador. `data/gitview.db` e `public/data/*` são gitignored, sempre regenerados pelos coletores.

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

git for-each-ref + git log/rev-list --no-merges
  (por repo, pool de 4, spawns assíncronos)
        │
        └──────────────────────────────► public/data/branches.json (inventário de branches + status)

team.local.json + stats.json + github.json
        │
        └──────────────────────────────► public/data/team.json    (devs + times + candidatos)

public/data/*.json ──► check-data.ts ──► gate: shape + invariantes (erro = coleta falha)
public/data/*.json ──► frontend 100% estático (Vue 3 + Vite + ECharts) — lê só public/data/
```

## O que cada seta faz

### git log → data/gitview.db

`collect.ts` roda `git log --all --no-renames --no-merges --numstat` em cada repo, normaliza os commits (autor canônico via aliases, data em UTC ISO) e insere no SQLite (`data/gitview.db`, chave `(repo, hash)`, `INSERT OR IGNORE`). É incremental por padrão: coleta de um watermark para cá com `--since`. Commits de merge ficam fora de todas as métricas; modos e regra em [Coletores](./collectors.md).

### data/gitview.db → stats.json + commits.json

`collect.ts` agrega o banco em `stats.json` (buckets de tempo, rollups por autor e por repo) e exporta `commits.json` com os 100 últimos commits de cada autor, mais recente primeiro. Os buckets saem de `GITVIEW_TIMEZONE`, nunca do fuso da máquina.

### API GraphQL do GitHub → github.json

`collect-github.ts` busca todos os PRs OPEN e os MERGED dos últimos 400 dias, com reviews inline na mesma query (paginação por cursor além de 100). Auth via `GITVIEW_GITHUB_TOKEN` (`.env` ou shell), com `gh auth token` como ponte opcional.

### refs do git → branches.json

O `collect-branches.ts` enumera `refs/heads` de cada clone (tip + data de committer) e calcula, por branch, ahead/behind vs a ref de produção e vs a primeira ref de integração — merges fora de toda contagem — mais os e-mails crus (`%ae`) e as linhas +/− dos autores à frente da produção. Cada branch recebe exatamente um status de uma union fechada (`production`, `integration`, `feature`, `bot`, `pousada`); os vínculos com PRs são calculados pelo frontend em join com o `github.json` (`headRef`). Roda só na cadeia full — a recoleta leve o pula (sem fetch, o resultado seria idêntico).

### git tag + API REST do GitHub → releases.json

`collect-releases.ts` lê as tags locais (`git tag`) para cobertura universal e as enriquece com nome, notas e URL da API REST. A contagem de commits entre tags vem do `data/gitview.db` e compara timestamps, nunca texto.

### team.local.json + stats/github → team.json

`collect-team.ts` mescla o `team.local.json` (perfis, times, bots) com as identidades vistas nos dados: devs, times e candidatos sem mapeamento. Roda por último porque lê `stats.json` e `github.json`.

## check-data.ts: o gate

Lê os seis JSONs e checa estrutura e invariantes entre arquivos. Erro derruba a coleta com exit 1; avisos nunca bloqueiam. A lista por arquivo está em [Modelo de dados](./data-model.md).

## O que é dev only

O `dist` do `pnpm build` busca só os JSONs de `public/data/`; o wizard (`/setup/*`), as Configurações (`/settings`) e os endpoints `/__*` (`/__collect`, `/__setup/*`, `/__auth/*`, `/__team/*`, `/__clean`) só existem no dev server.

Deploy de produção: rodar os coletores onde os dados precisam estar frescos e publicar `dist` + `public/data/`. Sem servidor, sem banco, sem token na máquina que serve o dashboard.
