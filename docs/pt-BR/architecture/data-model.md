---
title: Modelo de dados
description: Os shapes dos cinco JSONs em public/data/ e os invariantes que o check-data exige de cada um.
---

# Modelo de dados

O frontend consome exatamente cinco arquivos JSON de `public/data/`. São artefatos gitignored regenerados pelos coletores, mas o shape deles é contrato: o `check-data.ts` falha a coleta quando um campo que a UI lê some. Esta página documenta cada arquivo — chaves primeiro, depois o que o gate exige.

## Resumo

| arquivo | guarda | gravado por |
|---|---|---|
| `stats.json` | agregados: weekly/monthly/heatmap/monthlyTypes/perAuthor/perRepo/repoUrls/totals | `collect.ts` |
| `commits.json` | 100 últimos commits por autor | `collect.ts` |
| `github.json` | PRs (OPEN + MERGED 400d) com reviews, mapa login→dev | `collect-github.ts` |
| `releases.json` | tags, commits por tag, contagem de não liberados, notas de release | `collect-releases.ts` |
| `team.json` | devs, times, candidatos sem mapeamento | `collect-team.ts` |

Regras valem para os cinco: objeto no topo com `generatedAt` (timestamp ISO da execução), nomes de autor já canônicos (aliases aplicados na coleta), datas de commit em UTC ISO com milissegundos. As listas são esparsas — linhas zeradas simplesmente não existem (nada de `commits: 0` de preenchimento).

## stats.json

### Chaves

| chave | shape | significado |
|---|---|---|
| `generatedAt` | string ISO | quando o arquivo foi gerado |
| `repos` | `string[]` | nomes dos repos incluídos na coleta |
| `repoUrls` | `{ [repo]: string }` | URL web por repo (só remotes do GitHub) |
| `authors` | `[{ name, emails, bot }]` | autores canônicos e todos os e-mails vistos de cada |
| `totals` | `{ commits, additions, deletions, activeDays, repos, authors }` | rollup global |
| `perRepo` | `[{ repo, commits, additions, deletions, authors, lastCommit }]` | por repo, ordenado por commits desc |
| `perAuthor` | `[{ author, commits, additions, deletions, repos, activeDays, lastCommit, streak, longestStreak }]` | por dev, ordenado por commits desc; `streak` conta dias ativos consecutivos terminando no último dia ativo |
| `weekly` | `[{ week, repo, author, commits, weekend, night }]` | chave de semana ISO `YYYY-Www`; `weekend`/`night` são subconjuntos (night = 22:00–05:59 no fuso canônico) |
| `monthly` | `[{ month, repo, author, commits, additions, deletions }]` | chave de mês `YYYY-MM` |
| `heatmap` | `[{ author, repo, month, weekday, hour, commits }]` | `weekday` 0–6, `hour` 0–23; só os últimos 24 meses |
| `monthlyTypes` | `[{ month, repo, author, type, commits }]` | tipo de conventional commit (`feat`, `fix`, …) ou `outros` |

```json
{
  "author": "Ana Silva",
  "commits": 11523,
  "additions": 3494030,
  "deletions": 2964009,
  "repos": 14,
  "activeDays": 1312,
  "lastCommit": "2026-10-09T20:21:58.000Z",
  "streak": 5,
  "longestStreak": 53
}
```

### O que o check-data exige

- `generatedAt` ISO válido; `repos` lista de strings; `repoUrls` objeto.
- Primeiro item de `authors`/`perRepo`/`perAuthor`/`weekly`/`monthly`/`heatmap`/`monthlyTypes` carrega os campos esperados (ver tabela); `authors[].bot` é booleano.
- **O invariante central**: Σ`perAuthor.commits` = Σ`perRepo.commits` = Σ`monthly.commits` = `totals.commits`.
- `totals.additions`/`deletions` ≥ 0; contagens por autor ≥ 0; `heatmap.weekday` em 0–6 e `hour` em 0–23; `monthly.month` casa `YYYY-MM`.
- `perRepo[].lastCommit` parseia como data (aviso se estiver no futuro — relógio do autor errado, quebra o watermark incremental).

## commits.json

### Chaves

| chave | shape | significado |
|---|---|---|
| `generatedAt` | string ISO | quando o arquivo foi gerado |
| `commits` | `[{ hash, repo, author, date, message, additions, deletions }]` | 100 últimos commits por autor, mais recente primeiro |

`hash` é a forma abreviada 7-hex; `message` é o assunto do commit (limitado a 500 chars no banco); `date` é UTC ISO com milissegundos.

```json
{
  "hash": "80afade",
  "repo": "<repo>",
  "author": "Ana Silva",
  "date": "2026-10-09T20:21:58.000Z",
  "message": "chore: version 1.0.7",
  "additions": 8,
  "deletions": 6
}
```

### O que o check-data exige

- `generatedAt` ISO válido; todo item tem `hash`, `repo`, `author`, `date`, `message`.
- Datas uniformemente UTC (terminando em `Z`) e parseáveis — offsets mistos quebrariam a ordenação.
- Ordem decrescente estrita por timestamp real (a página de perfil do dev assume isso).
- `hash` casa `^[0-9a-f]{7}$`.
- Aviso (não bloqueante): commits com assunto de merge e diff zero nos primeiros 4000 itens — squash/pull regravado single-parent que infla contagens (issue #7).

## github.json

### Chaves

| chave | shape | significado |
|---|---|---|
| `generatedAt` | string ISO | quando o arquivo foi gerado |
| `users` | `{ [login]: { name, bot } }` | todo login visto (autores + reviewers) mapeado para o nome canônico do dev |
| `prs` | `[{ repo, number, title, url, state, draft, author, createdAt, mergedAt, additions, deletions, changedFiles, reviews }]` | todos os PRs OPEN + PRs MERGED dentro da janela |

Campos do PR: `state` é `OPEN` ou `MERGED`; `mergedAt` é `null` para PRs abertos; `author` é o login do GitHub mapeado via `users` (conta apagada vira `ghost`); `draft` marca PRs rascunho. `reviews` é `[{ author, state, submittedAt }]` com `state` em `APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING` (union fechada, issue #42).

```json
{
  "repo": "<repo>",
  "number": 5,
  "title": "feat: new export",
  "url": "https://github.com/<org>/<repo>/pull/5",
  "state": "MERGED",
  "draft": false,
  "author": "ana-dev",
  "createdAt": "2026-01-23T21:06:43Z",
  "mergedAt": "2026-02-01T12:00:00Z",
  "additions": 140,
  "deletions": 32,
  "changedFiles": 3,
  "reviews": [
    { "author": "bruno-dev", "state": "APPROVED", "submittedAt": "2026-01-24T10:00:00Z" }
  ]
}
```

### O que o check-data exige

- `generatedAt` ISO válido; `users` é objeto de `{ name: string, bot: boolean }`; o primeiro PR tem `repo`, `number`, `state`, `author`.
- `state` ∈ {`OPEN`, `MERGED`}; `MERGED` carrega `mergedAt` válido.
- Sem duplicados `repo#number`; `state` de review dentro da union fechada.
- Nenhum PR `MERGED` mais velho que a janela de 400 dias.

:::info Por que só 400 dias de PRs mergeados?
A visão de 12 meses do dashboard é a janela mais larga de PRs, e 400 dias cobre ela com folga ([issue #5](https://github.com/Enlighten-Brasil/gitview/issues/5)). Guardar todo PR mergeado para sempre cresceria o JSON sem alimentar painel nenhum; PRs mergeados mais antigos expiram naturalmente no merge incremental. O corte que vale é o `mergedAt` — um PR antigo com atividade recente (rebase, comentário) não entra pela porta do fetch incremental baseado em `updatedAt`.
:::

## releases.json

### Chaves

| chave | shape | significado |
|---|---|---|
| `generatedAt` | string ISO | quando o arquivo foi gerado |
| `repos` | `[{ repo, url, unreleased, tags }]` | uma entrada por repo |

As entradas de tag vêm da mais recente para a mais antiga:

| chave | shape | significado |
|---|---|---|
| `tag` | string | nome da tag |
| `date` | string ISO | data de criação da tag (UTC) |
| `commits` | number | commits entre a tag anterior e esta (primeira tag: desde o começo) |
| `name` | string \| null | título do release no GitHub (`null` sem release no GitHub) |
| `notes` | string \| null | corpo do release, truncado em 3000 chars |
| `prerelease` | boolean | flag de prerelease do GitHub |
| `url` | string \| null | URL do release no GitHub |

`unreleased` conta commits depois da tag mais nova. As contagens de commits comparam timestamps, nunca texto.

### O que o check-data exige

- `generatedAt` ISO válido; a primeira entrada de repo tem `repo`, `url`, `tags`, `unreleased`.
- Datas das tags parseáveis e em ordem decrescente; `commits` ≥ 0 por tag; `unreleased` finito e ≥ 0.
- **Invariante de cobertura**: `unreleased` + Σ `tags[].commits` = commits do repo no `stats.json.perRepo`.

## team.json

### Chaves

| chave | shape | significado |
|---|---|---|
| `generatedAt` | string ISO | quando o arquivo foi gerado |
| `devs` | `[{ name, title, description, emails, githubLogins, teams, bot }]` | devs canônicos (perfis + identidades vistas nos dados); `title`/`description` vêm do perfil de dev, `null` caso contrário |
| `teams` | `[{ name, description, color, members, renamedFrom? }]` | times do `team.local.json`; `renamedFrom` lista nomes antigos quando um time foi renomeado |
| `candidates` | `[{ kind, id, emails?, prs? }]` | identidades sem mapeamento: `kind: "author"` (nome cru do git, com `emails`) ou `kind: "login"` (login do GitHub, com contagem `prs`) |

`emails` e `githubLogins` são os aliases efetivos usados para unificar identidades; logins mantêm a grafia da API (deduplicados sem diferenciar maiúsculas). `ghost` (autor de PR apagado) e bots nunca aparecem como candidatos.

### O que o check-data exige

- `generatedAt` ISO válido; os primeiros itens de `devs`/`teams`/`candidates` carregam `name`/`name`/`kind`+`id` respectivamente (mais `bot`, `emails`, `githubLogins`, `teams` em devs; `members` em times).
- Nomes de dev únicos; todo membro de time é dev conhecido.
- `candidates[].kind` ∈ {`author`, `login`}; nunca `ghost` (invariante M1) e nunca login de bot.
- Sem logins duplicados por case dentro de um dev.
- Avisos (não bloqueantes): membro de time que também é candidato; dev humano sem nenhum alias.

## Próximos passos

- [Pipeline](./pipeline.md) — como esses arquivos são produzidos.
- [Coletores](./collectors.md) — os modos e filtros por trás destes shapes.
