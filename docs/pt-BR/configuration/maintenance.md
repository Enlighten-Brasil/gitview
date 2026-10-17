---
title: Manutenção dos dados
description: O que é regenerável, o que não é, e quando usar recoletar tudo, limpar e recoletar ou apagar dados — UI e CLI.
---

# Manutenção dos dados

Tudo que o dashboard mostra é dado gerado: o banco SQLite e os JSONs em `public/data/` são 100% regeneráveis a partir dos repositórios. O seu `.env` e o `team.local.json` não são — e nenhuma limpeza os toca.

## O que é regenerável (e o que não é)

| caminho | regenerável | observações |
|---|---|---|
| `data/gitview.db` (+ `-wal`/`-shm`) | sim | banco SQLite reconstruído pelos coletores |
| `public/data/*.json` | sim | `stats.json`, `commits.json`, `github.json`, `releases.json`, `team.json` — o build estático lê só eles |
| `data/repos/` | sim, mas lento | clones gerenciados (bare); a próxima coleta re-clona tudo |
| `.env` | **não** | config da máquina + o token do GitHub |
| `team.local.json` | **não** | o cadastro do time — nomes canônicos, aliases, times, bots |

## O card "Manutenção dos dados locais"

Abra **Config** → **Geral** (`/settings`; dev only — o card não existe no build estático). O card **Manutenção dos dados locais** tem três ações e um switch:

| ação | o que faz | quando usar |
|---|---|---|
| **recoletar tudo** | Roda uma coleta completa (`/__collect?full=1`) sem apagar nada | Os números estão velhos ou incompletos, mas você quer manter o banco |
| **limpar e recoletar** | Pergunta "Limpar e recoletar?", apaga banco + JSONs e roda uma coleta completa (`/__collect?full=1&clean=1`); clones intocados | Uma mudança de config precisa valer para o histórico todo (ex.: `GITVIEW_EXCLUDE_PATHS`), ou o banco parece inconsistente |
| **apagar dados** | Pergunta "Apagar os dados locais?", apaga sem coletar (`GET /__clean`) e volta ao wizard de configuração | Recomeçar do zero — trocar de org/repos, passar a máquina para outra pessoa |

O switch **apagar também os clones (data/repos)** remove também os clones gerenciados no **apagar dados** — a próxima coleta re-clona tudo (lento). Enquanto uma ação roda, o card mostra o log do coletor; no sucesso aparece **dados regenerados com sucesso**.

Depois do **apagar dados** o app derruba o estado "tem dados" em memória (`stats` + `resetBoot()`) e navega para `/setup` sem reload — toda rota de dados cai no wizard até a próxima coleta, que é exatamente o comportamento de primeira execução.

:::info Por que mudar GITVIEW_EXCLUDE_PATHS exige limpar e recoletar?
As métricas de linhas são calculadas na hora da coleta e gravadas no banco e nos JSONs — os globs de exclusão valem só para os commits escaneados a partir de então. Os números antigos já foram contados sem os padrões novos, e reescanear por cima deixaria o histórico inconsistente. Só a limpeza reconstrói as linhas de todos os commits com a lista nova.
:::

:::info Por que os clones sobrevivem à limpeza padrão?
Re-clonar é a parte cara de uma reconstrução (rede + histórico completo), enquanto banco e JSONs se refazem em minutos a partir dos clones já no disco. Por isso a limpeza padrão mantém `data/repos/` e só a flag explícita — **apagar também os clones (data/repos)** ou `pnpm clean -- --repos` — os remove.
:::

## O equivalente na CLI

```bash
pnpm clean              # apaga data/gitview.db* + public/data/*.json
pnpm clean -- --repos   # apaga também os clones gerenciados (próxima coleta re-clona — lento)
pnpm collect            # os 4 coletores em sequência + validação (incremental)
```

A limpeza da CLI é o mesmo código do **apagar dados** (`scripts/lib/clean.ts`) — incluindo a garantia de que `.env` e `team.local.json` sobrevivem. Depois do `pnpm clean`, rode `pnpm collect` (ou o botão ↻ na navbar) para regenerar os JSONs; o console lembra exatamente isso. Repare no `--` antes de `--repos`: o pnpm precisa dele para repassar a flag.

## Escolhendo a ação certa

- **Atualização do dia a dia** — o botão ↻ ou `pnpm collect`: incremental, soma commits/PRs/releases novos ao que já está coletado.
- **recoletar tudo** — roda todos os coletores em modo completo (`/__collect?full=1`) sem perder o banco.
- **limpar e recoletar** — o remédio para "os números foram calculados com a config errada": mudou `GITVIEW_EXCLUDE_PATHS`, sobrou lixo depois de um bug de coletor, ou o banco e os JSONs não batem. Equivale a `pnpm clean` + `pnpm collect`.
- **apagar dados** — apaga sem reconstruir: o dashboard volta ao wizard de configuração e espera você escolher os repos e coletar de novo.

:::warning
**apagar dados** e `pnpm clean` apagam só dados coletados. Mapeamentos de identidade, times e token vivem no `team.local.json` e no `.env` — veja [Config do time](./team.md) e [O arquivo .env](./env.md) antes de passar a máquina adiante.
:::

## Próximos passos

- [O arquivo .env](./env.md) — as chaves que definem o que é coletado.
- [Config do time (`team.local.json`)](./team.md) — o único arquivo que nunca é regenerado.
