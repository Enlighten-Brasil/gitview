---
title: Modelo de dados
description: Os shapes dos sete JSONs de public/data/ e os invariantes que o gate do check-data exige de cada um.
---

# Modelo de dados

O frontend consome exatamente seis dos sete JSONs em `public/data/` (o `daily.json` é coletado e validado para o motor de relatórios — issue #176 — mas ainda não é lido pelo frontend), mais um `graph-<repo>.json` por repo (topologia de commits para a vista de grafo — o frontend estático carrega só o arquivo do repo visitado). O shape é contrato: quando um campo que a UI lê some, o `check-data.ts` derruba a coleta. O comportamento geral do gate está em [Coletores](./collectors.md); aqui estão as chaves e as checagens de cada arquivo.

## Resumo

| arquivo | guarda | gravado por |
|---|---|---|
| `stats.json` | agregados: weekly/monthly/heatmap/monthlyTypes/perAuthor/perRepo/repoUrls/totals | `collect.ts` |
| `commits.json` | 100 últimos commits por autor | `collect.ts` |
| `daily.json` | agregado dia-preciso: dia × repo × autor (+ escopo), commits, linhas, flags de fim de semana/madrugada | `collect.ts` |
| `github.json` | PRs (OPEN + MERGED da janela de 400 dias) com reviews | `collect-github.ts` |
| `releases.json` | tags, commits por tag, não liberados, notas | `collect-releases.ts` |
| `team.json` | devs, times, candidatos sem mapeamento | `collect-team.ts` |
| `branches.json` | inventário de branches por repo: status, ahead/behind sem merges, autores à frente | `collect-branches.ts` |
| `graph-<repo>.json` | topologia de commits COM merges (um arquivo por repo, janela de `GITVIEW_GRAPH_WINDOW` commits) | `collect-graph.ts` |

Regras comuns aos sete: objeto no topo com `generatedAt` (timestamp ISO da execução), datas de commit em UTC ISO com milissegundos. Autores já canônicos (aliases aplicados na coleta) em todo arquivo **exceto `branches.json`**, que leva e-mails crus do git (`%ae`) por design — fato puramente git; o frontend mapeia e-mail→dev via `team.json#devs[].emails`. As listas são esparsas: linhas zeradas não existem (nada de `commits: 0` de preenchimento).

## stats.json

| chave | shape | significado |
|---|---|---|
| `repos` | `string[]` | nomes dos repos incluídos na coleta |
| `repoUrls` | `{ [repo]: string }` | URL web por repo (só remotes do GitHub) |
| `authors` | `[{ name, emails, bot }]` | autores canônicos e os e-mails vistos de cada |
| `totals` | `{ commits, prodCommits, progressCommits, additions, deletions, activeDays, repos, authors }` | rollup global; `prodCommits` + `progressCommits` = `commits` |
| `perRepo` | `[{ repo, commits, prodCommits, progressCommits, additions, deletions, authors, lastCommit }]` | por repo, ordenado por commits desc |
| `perAuthor` | `[{ author, commits, additions, deletions, repos, activeDays, lastCommit, streak, longestStreak, byScope? }]` | por dev, ordenado por commits desc; `streak` conta dias ativos consecutivos terminando no último dia ativo; `byScope` (issue #152) = eixos `{ prod, progress }` com os mesmos campos medidos sobre só as linhas do eixo (eixo prod = scope `'prod'`; progress = `'integration'` + `'branch'`) — ausente em dado coletado antes da feature (feature-detect no frontend); quando presente, AMBAS as chaves existem e o eixo vazio porta `lastCommit` `''`. Linhas com scope `NULL` ficam fora dos eixos (mesma convenção dos totals) |
| `weekly` | `[{ week, repo, author, scope?, commits, weekend, night }]` | semana ISO `YYYY-Www`; `weekend`/`night` são subconjuntos (night = 22:00–05:59 no fuso canônico) |
| `monthly` | `[{ month, repo, author, scope?, commits, additions, deletions }]` | chave de mês `YYYY-MM` |
| `heatmap` | `[{ author, repo, month, weekday, hour, scope?, commits }]` | `weekday` 0–6, `hour` 0–23; só os últimos 24 meses |
| `monthlyTypes` | `[{ month, repo, author, scope?, type, commits }]` | tipo de conventional commit (`feat`, `fix`, …) ou `outros` |

**Escopo de ref** (issue #119): todo commit carrega um `scope` no banco — `'prod'` (alcançável da ref de produção), `'integration'` (alcançável de alguma ref de integração e não de prod) ou `'branch'` (demais). As linhas do JSON usam a codificação *omit-prod*: o campo opcional `scope` só viaja quando o valor é `'integration'` ou `'branch'` — **ausente significa produção**. As chaves de agregação de `weekly`/`monthly`/`heatmap`/`monthlyTypes` incluem o escopo, então o mesmo autor/repo/período pode aparecer em até duas linhas (uma por escopo); as somas (Σ) são preservadas e as projeções do frontend que agrupam-e-somam não veem diferença. `progressCommits` = integration + branch (trabalho em progresso); os três valores explícitos vivem só no banco. Linhas com scope ainda `NULL` (classificação nunca rodou ou falhou no repo) ficam fora de todo bucket e o coletor loga um aviso — `--reaggregate` não roda git, logo não classifica.

**O gate exige**: Σ`perAuthor.commits` = Σ`perRepo.commits` = Σ`monthly.commits` = `totals.commits` (invariante central); `totals.prodCommits` + `totals.progressCommits` = `totals.commits`; Σ`monthly.commits` das linhas *sem* `scope` = `totals.prodCommits` e das linhas *com* `scope` = `totals.progressCommits` (o heatmap não ganha invariante de soma: o corte de 24 meses quebra Σ por design); `scope`, quando presente, dentro da union fechada `'integration' | 'branch'` (todas as listas); `totals.additions`/`deletions` ≥ 0 e contagens por autor ≥ 0; `heatmap.weekday` em 0–6 e `hour` em 0–23; `monthly.month` casa `YYYY-MM`; `authors[].bot` é booleano; `perRepo[].lastCommit` parseia como data; `byScope` por autor, quando presente, tem chaves exatamente `prod` e `progress` (union fechada), `prod.X + progress.X = linha.X` para `commits`/`additions`/`deletions`, `activeDays`/`repos`/`longestStreak` do eixo ≤ os da linha, `streak` do eixo ≤ o `longestStreak` do eixo (NÃO ≤ o `streak` da linha: o run da linha termina no último dia ativo dela, que pode ser do outro eixo — um dev cujo commit mais recente é progress pode ter `streak` da linha 1 enquanto o eixo prod guarda um run mais longo encerrado antes) e `lastCommit` do eixo ≤ o da linha (comparação de string ISO). **Aviso não bloqueante**: repo com `commits > 0` e `prodCommits = 0` (configuração suspeita da ref de produção).

## commits.json

| chave | shape | significado |
|---|---|---|
| `commits` | `[{ hash, repo, author, date, message, additions, deletions, scope? }]` | 100 últimos commits por autor, mais recente primeiro |

`hash` é a forma abreviada 7-hex; `message` é o assunto do commit, limitado a 500 chars no banco. `scope` usa a mesma codificação *omit-prod* do stats.json (ausente = produção); a amostra pula commits com escopo não classificado (`NULL` no banco).

**O gate exige**: datas uniformemente UTC (terminando em `Z`) e parseáveis; ordem decrescente estrita por timestamp real (a página de perfil do dev assume isso); `hash` casa `^[0-9a-f]{7}$`; `scope`, quando presente, dentro da union fechada `'integration' | 'branch'`.

## daily.json

| chave | shape | significado |
|---|---|---|
| `daily` | `[{ day, repo, author, scope?, commits, additions, deletions, weekend, night }]` | uma linha por dia × repo × autor (× escopo); histórico completo, sem corte |

`day` é a data no fuso canônico `YYYY-MM-DD` (`dayKeyOf` — nunca um `slice` UTC, que deslocaria o limite dos dias e divergiria de `totals.activeDays`). `weekend`/`night` são os mesmos subconjuntos do `stats.json#weekly` (night = 22:00–05:59 no fuso canônico), então o off-hours fica dia-preciso em qualquer janela rolante. O arquivo é lazy como o `commits.json` (fora do carregamento inicial) e carrega o histórico inteiro (~19 KB/ano de linhas; reavaliar perto de 2 MB). Existe para o motor de relatórios (issue #176), cujas janelas rolantes de 7/30 dias precisam cortar por dia em vez de aproximar semana/mês (erro mediano acima de 100%).

**O gate exige**: `day` casa `YYYY-MM-DD`; Σ`daily.commits` = `totals.commits`; Σ das linhas sem `scope` = `totals.prodCommits` e das linhas com `scope` = `totals.progressCommits`; Σ`additions`/Σ`deletions` = os totals; Σ`weekend` = Σ`weekly.weekend` e Σ`night` = Σ`weekly.night` (mesmos predicados sobre as mesmas linhas); `scope`, quando presente, dentro da union fechada `'integration' | 'branch'`. **Aviso não bloqueante**: número de `day` distintos ≠ `totals.activeDays` (fuso canônico deslocado na coleta).

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

## branches.json

| chave | shape | significado |
|---|---|---|
| `repos` | `[{ repo, productionRef, integrationRefs, branches }]` | uma entrada por repo; `productionRef`/`integrationRefs` são as refs resolvidas por `scripts/lib/refs.ts` (`integrationRefs` lista só as que existem naquele repo) |

| chave de branch | shape | significado |
|---|---|---|
| `name` | string | nome da branch (nome curto do ref em `refs/heads`) |
| `tip` | string | SHA do commit da ponta (40-hex completo, como enumerado do clone) |
| `lastActivity` | string ISO | committer date do tip, em UTC |
| `aheadProd` / `behindProd` | number | commits à frente / atrás da ref de produção, **sem merges** (decisão da issue #7) |
| `aheadInt` / `behindInt` | number \| null | idem vs a PRIMEIRA ref de integração resolvida (ordem da config); `null` quando o repo não tem ref de integração |
| `authorsAhead` | `string[]` | e-mails **crus** (`%ae`) distintos dos autores dos commits à frente da produção |
| `additions` / `deletions` | number | somas cruas do numstat dos commits à frente da produção |
| `status` | string | union fechada: `production`, `integration`, `feature`, `bot`, `pousada` |

`pousada` = `aheadProd = 0`, `aheadInt` nulo ou 0, e sem atividade há ≥ `GITVIEW_BRANCH_STALE_DAYS` dias (default 30). `bot` casa o prefixo `dependabot/` ou `renovate/` (`BOT_BRANCH_RE`) ou nome exato em `GITVIEW_BOT_BRANCHES`. Precedência de status: production → integration → bot → pousada → feature. Os vínculos com PRs (branch viva sem PR, pousada mergeada via squash) são calculados pelo frontend em join com o `github.json` (`headRef`) — não fazem parte do status.

```json
{
  "repo": "<repo>",
  "productionRef": "main",
  "integrationRefs": ["develop"],
  "branches": [
    {
      "name": "feat/new-export",
      "tip": "3f9a1c7e5b2d84061fa9c3e7b5d20481af6c9e3b",
      "lastActivity": "2026-01-23T21:06:42.000Z",
      "aheadProd": 4,
      "behindProd": 12,
      "aheadInt": 4,
      "behindInt": 0,
      "authorsAhead": ["ana-dev@example.com"],
      "additions": 140,
      "deletions": 32,
      "status": "feature"
    }
  ]
}
```

**O gate exige**: `generatedAt` válido; todo `repo` presente no `stats.json#repos`; exatamente 1 branch com status `production` por repo, com nome igual ao `productionRef` daquela entrada; nomes de branch únicos por repo; `tip` casando `^[0-9a-f]{7,40}$`; `aheadProd`/`behindProd`/`additions`/`deletions` inteiros ≥ 0; `aheadInt`/`behindInt` inteiros ≥ 0 ou `null`; `status` dentro da union fechada; `authorsAhead` lista de strings com `@`; `lastActivity` parseável como data. **Avisos não bloqueantes**: `lastActivity` no futuro (mais de 1 dia de folga); repo sem nenhuma ref de integração.

## graph-\<repo\>.json

Um arquivo por repo (`graph-<repo>.json`, `<repo>` = nome da pasta do clone, o mesmo nome usado em `stats.json#repos`): a topologia de commits para a vista de grafo, COM merges — eles são os conectores do desenho. O coletor lê o git diretamente (`git log --all --date-order`); não alimenta o banco nem o `stats.json`, então a decisão `--no-merges` das métricas segue intacta.

| chave | shape | significado |
|---|---|---|
| `generatedAt` | string ISO | timestamp da execução que gravou este arquivo |
| `repo` | string | nome do repo (igual ao nome do arquivo sem extensão) |
| `window` | number | `GITVIEW_GRAPH_WINDOW` usado na execução (default 1000) — CONTAGEM de commits, não dias |
| `commits` | `[{ hash, parents, author, date, subject, refs }]` | os últimos `window` commits de todos os refs, em ordem descendente por timestamp |

| chave de commit | shape | significado |
|---|---|---|
| `hash` | string | SHA completo 40-hex |
| `parents` | `string[]` | SHAs completos 40-hex dos pais: `[]` na raiz, 2+ em merge. Pais fora da janela NÃO são resolvidos — o renderer indexa hash→linha e os clipa |
| `author` | string | autor canônico (aliases aplicados na coleta) |
| `date` | string ISO | author date em UTC com milissegundos (`2026-02-01T12:00:00.000Z`) |
| `subject` | string | assunto do commit (`%s`, linha única) |
| `refs` | `string[]` | itens da decoration (`%D`), um por entrada: `HEAD -> main`, `tag: v1.0.0`, `develop`…; `[]` sem refs. Clones gerenciados são BARE com refs locais (`refs/heads/*`, sem prefixo `origin/`): branches saem com nome curto |

```json
{
  "generatedAt": "2026-02-01T12:34:56.000Z",
  "repo": "<repo>",
  "window": 1000,
  "commits": [
    {
      "hash": "3f9a1c7e5b2d84061fa9c3e7b5d20481af6c9e3b",
      "parents": ["9c8f6e2a1d4b70358fa9c3e7b5d20481af6c9e11", "1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d"],
      "author": "ana-dev",
      "date": "2026-02-01T12:00:00.000Z",
      "subject": "Merge branch 'feat/new-export' into main",
      "refs": ["HEAD -> main"]
    },
    {
      "hash": "9c8f6e2a1d4b70358fa9c3e7b5d20481af6c9e11",
      "parents": ["7d6c5b4a39281706f5e4d3c2b1a0988776655443"],
      "author": "bruno-dev",
      "date": "2026-01-31T18:05:13.000Z",
      "subject": "feat: new export",
      "refs": []
    }
  ]
}
```

**O gate exige** (por arquivo presente): `generatedAt` válido; `repo` igual ao nome do arquivo sem extensão; `window` inteiro > 0 e `commits` com no máximo `window` itens; todo `hash` e `parents[]` casando `^[0-9a-f]{40}$`; `author` string não vazia; `date` em UTC ISO com milissegundos; `subject`/`refs` presentes (`refs` lista de strings); ordem descendente por timestamp real; sem hash duplicado. **Avisos não bloqueantes**: repo do `stats.json#repos` sem o seu `graph-<repo>.json` (só a coleta completa gera — a recoleta leve deixa os arquivos existentes intocados e a UI mostra empty-state); arquivo de grafo cujo repo não está no `stats.json#repos` (órfão — o repo saiu da seleção; `pnpm clean` remove).
