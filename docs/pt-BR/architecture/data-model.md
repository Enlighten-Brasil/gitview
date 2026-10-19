---
title: Modelo de dados
description: Os shapes dos cinco JSONs de public/data/ e os invariantes que o gate do check-data exige de cada um.
---

# Modelo de dados

O frontend consome exatamente cinco JSONs em `public/data/`. O shape é contrato: quando um campo que a UI lê some, o `check-data.ts` derruba a coleta. O comportamento geral do gate está em [Coletores](./collectors.md); aqui estão as chaves e as checagens de cada arquivo.

## Resumo

| arquivo | guarda | gravado por |
|---|---|---|
| `stats.json` | agregados: weekly/monthly/heatmap/monthlyTypes/perAuthor/perRepo/repoUrls/totals | `collect.ts` |
| `commits.json` | 100 últimos commits por autor | `collect.ts` |
| `github.json` | PRs (OPEN + MERGED da janela de 400 dias) com reviews | `collect-github.ts` |
| `releases.json` | tags, commits por tag, não liberados, notas | `collect-releases.ts` |
| `team.json` | devs, times, candidatos sem mapeamento | `collect-team.ts` |

Regras comuns aos cinco: objeto no topo com `generatedAt` (timestamp ISO da execução), autores já canônicos (aliases aplicados na coleta), datas de commit em UTC ISO com milissegundos. As listas são esparsas: linhas zeradas não existem (nada de `commits: 0` de preenchimento).

## stats.json

| chave | shape | significado |
|---|---|---|
| `repos` | `string[]` | nomes dos repos incluídos na coleta |
| `repoUrls` | `{ [repo]: string }` | URL web por repo (só remotes do GitHub) |
| `authors` | `[{ name, emails, bot }]` | autores canônicos e os e-mails vistos de cada |
| `totals` | `{ commits, additions, deletions, activeDays, repos, authors }` | rollup global |
| `perRepo` | `[{ repo, commits, additions, deletions, authors, lastCommit }]` | por repo, ordenado por commits desc |
| `perAuthor` | `[{ author, commits, additions, deletions, repos, activeDays, lastCommit, streak, longestStreak }]` | por dev, ordenado por commits desc; `streak` conta dias ativos consecutivos terminando no último dia ativo |
| `weekly` | `[{ week, repo, author, commits, weekend, night }]` | semana ISO `YYYY-Www`; `weekend`/`night` são subconjuntos (night = 22:00–05:59 no fuso canônico) |
| `monthly` | `[{ month, repo, author, commits, additions, deletions }]` | chave de mês `YYYY-MM` |
| `heatmap` | `[{ author, repo, month, weekday, hour, commits }]` | `weekday` 0–6, `hour` 0–23; só os últimos 24 meses |
| `monthlyTypes` | `[{ month, repo, author, type, commits }]` | tipo de conventional commit (`feat`, `fix`, …) ou `outros` |

**O gate exige**: Σ`perAuthor.commits` = Σ`perRepo.commits` = Σ`monthly.commits` = `totals.commits` (invariante central); `totals.additions`/`deletions` ≥ 0 e contagens por autor ≥ 0; `heatmap.weekday` em 0–6 e `hour` em 0–23; `monthly.month` casa `YYYY-MM`; `authors[].bot` é booleano; `perRepo[].lastCommit` parseia como data.

## commits.json

| chave | shape | significado |
|---|---|---|
| `commits` | `[{ hash, repo, author, date, message, additions, deletions }]` | 100 últimos commits por autor, mais recente primeiro |

`hash` é a forma abreviada 7-hex; `message` é o assunto do commit, limitado a 500 chars no banco.

**O gate exige**: datas uniformemente UTC (terminando em `Z`) e parseáveis; ordem decrescente estrita por timestamp real (a página de perfil do dev assume isso); `hash` casa `^[0-9a-f]{7}$`.

## github.json

| chave | shape | significado |
|---|---|---|
| `users` | `{ [login]: { name, bot } }` | todo login visto (autores + reviewers) mapeado para o nome canônico |
| `prs` | `[{ repo, number, title, url, state, draft, author, createdAt, mergedAt, additions, deletions, changedFiles, headRef?, baseRef?, headRefOid?, reviews }]` | todos os PRs OPEN + MERGED dentro da janela de 400 dias |

`state` é `OPEN` ou `MERGED`; `mergedAt` é `null` em PR aberto. `author` é o login mapeado via `users` (conta apagada vira `ghost`). `reviews` é `[{ author, state, submittedAt }]` com `state` em `APPROVED | CHANGES_REQUESTED | COMMENTED | DISMISSED | PENDING`.

`headRef`/`baseRef` são os nomes das branches head e base do PR e `headRefOid` é o SHA do head no momento da coleta — o vínculo PR↔branch, e `headRef` permanece nos PRs mergeados mesmo após a branch ser apagada. Os três são **opcionais**: o merge incremental continua propagando linhas de caches anteriores aos campos, então PRs históricos ficam sem eles até um único rebuild completo (`pnpm clean && pnpm collect`) preencher tudo. Consumidores devem tratar ref ausente como vínculo desconhecido (cobertura parcial), nunca como PR inexistente.

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
  "headRef": "feat/new-export",
  "baseRef": "main",
  "headRefOid": "3f9a1c7e5b2d84061fa9c3e7b5d20481af6c9e3b",
  "reviews": [
    { "author": "bruno-dev", "state": "APPROVED", "submittedAt": "2026-01-24T10:00:00Z" }
  ]
}
```

**O gate exige**: `users` é objeto de `{ name: string, bot: boolean }`; todo `MERGED` tem `mergedAt` válido; sem duplicados `repo#number`; `state` de review dentro da union; nenhum `MERGED` mais velho que a janela (o gate tolera 1 dia de folga sobre `generatedAt` para não marcar PR coletado no corte). O gate **não** exige `headRef`/`baseRef`/`headRefOid`: linhas preservadas de caches anteriores aos campos ficam legitimamente sem eles.

## releases.json

| chave | shape | significado |
|---|---|---|
| `repos` | `[{ repo, url, unreleased, tags }]` | uma entrada por repo; tags da mais nova para a mais antiga |

| chave de tag | shape | significado |
|---|---|---|
| `tag` | string | nome da tag |
| `date` | string ISO | criação da tag (UTC) |
| `commits` | number | commits entre a tag anterior e esta (primeira tag: desde o começo) |
| `name` | string \| null | título do release no GitHub (`null` sem release lá) |
| `notes` | string \| null | corpo do release, truncado em 3000 chars |
| `prerelease` | boolean | flag de prerelease do GitHub |
| `url` | string \| null | URL do release no GitHub |

`unreleased` conta commits depois da tag mais nova; as contagens comparam timestamps, nunca texto.

**O gate exige**: datas das tags parseáveis e em ordem decrescente; `commits` ≥ 0 por tag; `unreleased` finito e ≥ 0; invariante de cobertura `unreleased` + Σ `tags[].commits` = commits do repo em `stats.json.perRepo`.

## team.json

| chave | shape | significado |
|---|---|---|
| `devs` | `[{ name, title, description, emails, githubLogins, teams, bot }]` | devs canônicos; `title`/`description` vêm do perfil, `null` caso contrário; `emails`/`githubLogins` são os aliases efetivos, logins com a grafia da API |
| `teams` | `[{ name, description, color, members, renamedFrom? }]` | times do `team.local.json`; `renamedFrom` lista nomes antigos de time renomeado |
| `candidates` | `[{ kind, id, emails?, prs? }]` | identidades sem mapeamento: `kind: "author"` (nome cru do git, com `emails`) ou `kind: "login"` (login do GitHub, com contagem `prs`) |

**O gate exige**: nomes de dev únicos; todo membro de time é dev conhecido; `candidates[].kind` ∈ {`author`, `login`}, nunca `ghost` nem login de bot; sem logins duplicados ignorando maiúsculas dentro de um dev.
