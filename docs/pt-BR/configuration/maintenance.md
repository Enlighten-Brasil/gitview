---
title: Manutenção dos dados
description: O que é regenerável, o que sobrevive à limpeza e quando recoletar tudo, limpar e recoletar ou apagar dados.
---

# Manutenção dos dados

O que o dashboard mostra é dado gerado: banco e JSONs se refazem a partir dos repositórios. `.env` e `team.local.json` não se refazem, e nenhuma limpeza os toca.

## O que é regenerável

| caminho | regenerável | observação |
|---|---|---|
| `data/gitview.db` (+ `-wal`/`-shm`) | sim | banco recriado pelos coletores |
| `public/data/*.json` | sim | os 8 JSONs fixos + os `graph-*.json` por repo que o frontend lê |
| `data/repos/` | sim, mas lento | clones bare; re-clonar é a parte cara |
| `.env` | **não** | config da máquina e o token |
| `team.local.json` | **não** | cadastro do time |

## As ações

| ação | o que faz | quando usar |
|---|---|---|
| ↻ na navbar, ou `pnpm collect` | coleta incremental, só o que mudou | atualização do dia a dia |
| **salvar + recoletar** (`/teams`) | recoleta leve: re-aplica aliases, sem git scan | mexeu em identidade ou perfil |
| **recoletar tudo** | coleta completa sem apagar o banco | números velhos ou incompletos |
| **limpar e recoletar** | apaga banco + JSONs e roda a completa | config nova para todo o histórico |
| **apagar dados** | apaga sem coletar e volta ao wizard | trocar de org ou repassar a máquina |

- O card **Manutenção dos dados locais** em **Config** → **Geral** tem as três últimas ações, com log do coletor ao vivo. Card e botão ↻ só existem no dev server.
- Limpar antes de recoletar é o que refaz número calculado com config errada: `GITVIEW_EXCLUDE_PATHS` novo, alias removido, merge ainda gravado no banco.
- O switch **apagar também os clones (data/repos)** vale só para **apagar dados**; a próxima coleta re-clona tudo. Depois dela o app volta ao `/setup`, igual à primeira execução.

## Pela CLI

```bash
pnpm clean              # apaga data/gitview.db* + public/data/*.json
pnpm clean -- --repos   # apaga também os clones de data/repos
pnpm collect            # os 6 coletores em sequência + validação
pnpm collect:full       # a mesma cadeia com --full (re-scan completo + refetch)
pnpm collect:reaggregate # leve: re-agregação + PRs + time + validação
```

O `--` antes de `--repos` é obrigatório: sem ele o pnpm não repassa a flag. Depois de `pnpm clean` rode `pnpm collect` (ou ↻) para regenerar os JSONs.

Depois de atualizar uma instalação existente, `pnpm collect:reaggregate` emite o `report-commits.json` do banco SQLite atual sem `clean` nem scan completo. A etapa `collect.ts --reaggregate` não roda `git fetch` nem `git log`, não reclassifica escopos nem expurga inalcançáveis. A etapa `collect-github.ts` encadeada ainda busca PRs via GraphQL. Mantenha o fuso canônico configurado para que os valores de `day` continuem iguais aos do `daily.json`.

:::warning
Nenhuma dessas ações apaga config ou cadastro: para zerar token e time, apague `.env` e `team.local.json` à mão.
:::

## Próximos passos

- [O arquivo .env](./env.md): as chaves que definem o que é coletado.
- [Config do time (`team.local.json`)](./team.md): o arquivo que nunca é regenerado.
- [Coletores](../architecture/collectors.md): flags `--full` e `--reaggregate`.
