---
title: Coletores
description: O que cada coletor de scripts/ lê, o que grava e como controlar os modos de execução.
---

# Coletores

Os coletores de `scripts/` leem os repos git e a API do GitHub e gravam os sete JSONs de `public/data/` mais um `graph-<repo>.json` por repo (topologia de commits para a vista de grafo). O `pnpm collect` roda os seis em sequência e fecha com o `check-data.ts`; coletores que percorrem repos usam pool de 4. O mapeamento de identidade é explícito: logins e e-mails resolvem para nomes canônicos via `devProfiles` no `team.local.json` (`scripts/lib/team.ts`), nunca por matching aproximado.

## Resumo

| script | saída | fonte |
|---|---|---|
| `collect.ts` | `stats.json` (agregados, com os eixos `byScope` prod/progress por autor) + `commits.json` (100 últimos/autor) | `git log --all --no-renames --no-merges --numstat` → SQLite incremental |
| `collect-github.ts` | `github.json` (PRs + reviews, mapa login→dev) | API GraphQL do GitHub (token no `.env` ou `gh`) |
| `collect-branches.ts` | `branches.json` (inventário de branches: status em union fechada, ahead/behind sem merges, e-mails crus dos autores à frente, linhas +/−) | `git for-each-ref` + `git log`/`rev-list` nos clones locais |
| `collect-graph.ts` | `graph-<repo>.json` (topologia de commits COM merges, um arquivo por repo: hash/parents 40-hex, autor canônico, data UTC ISO ms, subject, decoration de refs/tags) | `git log --all --date-order` nos clones locais (janela `GITVIEW_GRAPH_WINDOW`, default 1000) |
| `collect-releases.ts` | `releases.json` (tags, commits por tag, não liberados, notas) | `git tag` + API REST do GitHub |
| `collect-team.ts` | `team.json` (devs, times, candidatos sem mapeamento) | `team.local.json` + `stats.json`/`github.json` |
| `check-data.ts` | — (só valida; exit 1 em erro) | os JSONs de `public/data/` (os 7 fixos + os `graph-*.json` presentes) |

## Coleta incremental

- **`collect.ts` (padrão)**: o `git log` recebe `--since=<watermark>` por repo: `MAX(date)` do banco menos 7 dias, margem que cobre commits com committer date antiga. `INSERT OR IGNORE` em `(repo, hash)` torna a sobreposição inócua.
- **`--full`**: re-escaneia todo o histórico, ignorando o watermark. O `pnpm collect:full` roda a cadeia inteira com esta flag em `collect.ts` e `collect-github.ts` (os únicos dois que a leem).
- **`--reaggregate`**: pula fetch e `git log`; re-aplica aliases às linhas gravadas e re-exporta os JSONs. Os eixos `byScope` derivam da coluna `scope` gravada, então este modo os repopula sem git. O `pnpm collect:reaggregate` o roda pela CLI.
- **`collect-github.ts`**: refaz o fetch só dos PRs atualizados desde a última coleta (margem de 1 dia) e mescla com o arquivo anterior; MERGED já gravados são preservados, a lista fresca de OPEN é a verdade, e PRs cujo `mergedAt` ficou fora da janela expiram. `--full` ignora o cache no fetch, e o arquivo anterior segue como rede de segurança: repo que falha não sai zerado do painel.
- **`collect-branches.ts`**: sem modo incremental — toda execução re-enumeria `refs/heads` por completo (pool de 4 com spawns assíncronos; ~25s para ~200 branches em 14 repos). Nunca faz fetch: o frescor fica atrelado ao fetch do `collect.ts` no início da cadeia, como o `stats.json`.
- **`collect-graph.ts`**: sem modo incremental — toda execução re-percorre os últimos `GITVIEW_GRAPH_WINDOW` commits por repo (default 1000; pool de 4 com spawns assíncronos, ~1s para 14 repos) e reescreve o seu `graph-<repo>.json`. Nunca faz fetch nem toca o banco ou o `stats.json`: o frescor fica atrelado ao fetch do `collect.ts` no início da cadeia.

Em toda execução do `collect.ts`: repos fora da seleção são podados do banco (se voltarem, o watermark vazio força scan completo) e datas fora do formato UTC são normalizadas.

## Recoleta leve

`GET /__collect?light=1` (botão **salvar + recoletar** em `/teams`) roda `collect.ts --reaggregate`, `collect-github.ts` incremental, `collect-team.ts` e `check-data.ts` — os mesmos passos do `pnpm collect:reaggregate` na CLI. Pula git scan, releases, branches e graph: edição de time muda identidade, não histórico — e sem fetch, re-enumerar as branches ou re-percorrer a topologia devolveria exatamente o resultado do último full, só com custo. Os `graph-*.json` existentes SOBREVIVEM à recoleta leve sem toque (nada os reescreve nem apaga); o gate valida os arquivos presentes e repo do `stats.json` sem o seu arquivo de grafo é aviso, não erro — só a coleta completa o gera.

## Clones gerenciados: fetch e read-only

Os clones do setup vivem em `data/repos/` (bare, gitignored). No início do `collect.ts`, cada um recebe `git fetch --all --prune --tags`, com três travas:

- **Token nunca em disco**: a auth é injetada só no processo do comando via `GIT_CONFIG_COUNT`/`GIT_CONFIG_KEY_0`/`GIT_CONFIG_VALUE_0` (`extraheader` Basic com `x-access-token:*** nada em argv nem no config do clone; `GIT_TERMINAL_PROMPT=0` bloqueia prompt de credencial.
- **`scrubPersistedToken`**: remove `extraheader` gravados no config do clone por execuções passadas. Idempotente, roda a cada coleta.
- **`denyPush`**: grava `remote.origin.pushurl=no-push`; `git push` falha mesmo com credencial de escrita. Aplicado no clone e a cada coleta.

Falha de fetch é tolerada: o coletor avisa e usa o cache local.

## Datas e fuso horário

- **Gravação**: UTC ISO com milissegundos (`2026-10-08T18:05:13.000Z`); comparação lexicográfica e ordenação dependem desse formato.
- **Agregação**: todo bucket (mês, dia, semana ISO, fim de semana, madrugada, heatmap) é calculado em `GITVIEW_TIMEZONE` (default `America/Sao_Paulo`) via `Intl`, nunca no relógio da máquina; nome IANA inválido cai no default com aviso. O mesmo banco produz agregados byte-idênticos em qualquer máquina, e os buckets refletem a madrugada e o fim de semana reais do time. Streaks usam aritmética calendária sobre chaves de dia, imunes a DST; desde a issue #152 a mesma aritmética também roda por eixo de escopo — `perAuthor[].byScope.{prod,progress}` porta os campos medidos da linha recalculados sobre as linhas do próprio eixo (conjuntos de dias e repos, somas, último commit).
- **Ordem**: decidem timestamps, não strings: o `collect-releases.ts` conta commits por release comparando epochs, e o gate confere a ordem decrescente real do `commits.json`.

## O que nunca entra nas métricas

- **Linhas de arquivos gerados**: lockfiles, minificados e gerados não contam nas métricas de linhas; os commits deles contam. O filtro roda no parse do numstat, por linha: um pathspec no `git log` excluiria commits inteiros das contagens e heatmaps. Lista: `DEFAULT_EXCLUDE_PATHS` (`scripts/lib/config.ts`) mais `GITVIEW_EXCLUDE_PATHS` (CSV de globs). Semântica: `*` casa dentro de um segmento, `**` em qualquer profundidade; padrão com `/` casa o caminho todo, sem `/` só o basename; case-sensitive como `.gitignore`.
- **Commits de merge**: removidos por topologia (`--no-merges`), não por assunto; o diff `+0-0` inflaria commits/dia, ritmo e streaks, e a produção já está contada no PR. Single-parent com assunto "Merge" (squash/pull regravado) conta. A ÚNICA exceção é o `collect-graph.ts`: o arquivo de topologia leva merges porque eles são os conectores do desenho do grafo — ele não alimenta o banco nem as métricas, então a decisão segue intacta.
- **Linhas sem data parseável**: saem de todos os buckets; o coletor avisa com a contagem.

Regras de insert não alcançam linhas já gravadas, nem aliases removidos revertem nomes no banco: `pnpm clean && pnpm collect` refaz tudo.

## check-data.ts: o gate

O `pnpm check:data` roda sozinho e como último passo do `pnpm collect` e do `/__collect`. Só lê `public/data/`; erro de estrutura ou invariante derruba a coleta com exit 1.

- **Estrutura**: cada arquivo existe, parseia para objeto no topo, tem `generatedAt` ISO válido e o primeiro item das listas traz os campos que o frontend lê. Invariantes por arquivo no [Modelo de dados](./data-model.md).
- **Avisos não bloqueantes** (imprimem, nunca são fatais): membro de time que também é candidato sem mapeamento; dev humano sem aliases; `lastCommit` no futuro (relógio do autor errado, quebra o watermark); merge com diff zero na amostra do `commits.json`.

## Comandos

```bash
pnpm collect            # os 6 coletores em sequência + check-data no fim
pnpm collect:full       # a mesma cadeia com --full (re-scan completo + refetch)
pnpm collect:reaggregate # leve: re-agregação + PRs + time + check-data
pnpm collect:github     # só PRs
pnpm collect:branches   # só branches
pnpm collect:graph      # só a topologia de commits (graph-*.json, com merges)
pnpm collect:releases   # só releases
pnpm collect:team       # só time
pnpm check:data         # só a validação (shape + invariantes)
pnpm clean              # apaga banco + JSONs (clones só com flag)
```
