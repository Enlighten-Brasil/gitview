---
title: O arquivo .env
description: Todas as chaves GITVIEW_* com default e formato — precedência, releitura, aspas, caminhos Windows e a migração do config.json legado.
---

# O arquivo `.env`

O arquivo `.env` guarda a configuração da máquina: credenciais do GitHub, onde estão os clones, o que ignorar nas buscas e que fuso os buckets de tempo usam. Ele é gitignored, criado automaticamente a partir do `.env.example` na primeira execução, e carrega o **único segredo** do projeto (`GITVIEW_GITHUB_TOKEN`).

## Todas as chaves

| chave | o que faz | default | formato |
|---|---|---|---|
| `GITVIEW_GITHUB_CLIENT_ID` | Client ID (público) de um OAuth App (`Ov…`) ou GitHub App (`Iv…`) com device flow habilitado — mostra o botão **Conectar com GitHub** no wizard de configuração | vazio (`.env.example` vem com um exemplo) | string |
| `GITVIEW_GITHUB_TOKEN` | Token gravado pelo device flow, por um PAT colado ou pela UI do setup. **Nunca versione** | vazio → usa `gh auth token` se o GitHub CLI estiver logado | string de token |
| `GITVIEW_GITHUB_ORG` | Org default do wizard de configuração e da importação de times em `/teams` | vazio | login da org |
| `GITVIEW_REPOS_ROOT` | Pasta com os clones dos repositórios | vazio → `data/repos` (criado pelo setup) | caminho absoluto ou relativo à raiz do repositório |
| `GITVIEW_DEFAULT_REPOS` | Repos pré-selecionados no wizard de configuração | vazio = todos os não arquivados | CSV |
| `GITVIEW_EXCLUDE` | Pastas ignoradas na descoberta de repos | vazio | CSV |
| `GITVIEW_EXCLUDE_PATHS` | Globs de arquivos gerados ignorados nas métricas de linhas — acrescenta à lista padrão abaixo | vazio = só a lista padrão | CSV de globs |
| `GITVIEW_PORT` | Porta do dev server (`pnpm dev` / `pnpm start`) | `5173` | inteiro 1–65535 (valores fora da faixa são ignorados) |
| `GITVIEW_TIMEZONE` | Fuso IANA de todos os buckets de tempo (mês, dia, semana ISO, fim de semana, madrugada, heatmap) | `America/Sao_Paulo` | nome IANA (`America/Sao_Paulo`, `Europe/Lisbon`, `UTC`) |

Valores CSV são separados por vírgula, com espaços das bordas removidos (ex.: `repo-a, repo-b`). Uma linha vazia como `GITVIEW_GITHUB_ORG=` significa "a chave existe, desligada".

## Como os valores são resolvidos

- **Precedência: variável do shell → `.env` → default.** A variável do shell sempre vence, mesmo com valor no `.env`. Vazio ou só espaços conta como "não definido".
- **Releitura a cada chamada.** O arquivo é parseado a cada execução de coletor e nunca é carregado no ambiente do processo — um token novo vale sem reiniciar o dev server.
- **A primeira execução cria o arquivo.** `pnpm dev`, `pnpm start` ou qualquer coletor copiam `.env.example` para `.env` quando ele não existe. Quando o `.env.example` ganha chaves que o seu `.env` não tem, a execução imprime um aviso (1× por processo) listando as chaves ausentes.
- **A UI do setup grava as chaves linha a linha** (via `saveConfig()`), preservando comentários e ordem; chaves novas são anexadas no fim. Dados de time nunca caem aqui — vão para o [`team.local.json`](./team.md).

:::info Por que o .env é relido a cada execução?
Os coletores rodam como filhos do dev server e leem o arquivo a cada invocação, em vez de herdar um retrato do ambiente. É isso que torna o token trocável a quente: cole um PAT novo na UI (ou edite o arquivo) e a próxima coleta já usa — sem reiniciar, sem credencial velha rondando na memória.
:::

## Aspas e caminhos Windows

- Valores gravados pela UI do setup ficam entre **aspas simples** (`GITVIEW_REPOS_ROOT='C:/dev/my repos'`). O parser não expande escapes dentro de aspas simples.
- Um valor não pode conter aspa simples nem quebra de linha — a UI recusa gravar.
- Em Windows use barras normais (`C:/dev/repos/api`); ponha aspas simples quando o caminho tiver espaços.

## A lista padrão de exclusão das métricas de linhas

`GITVIEW_EXCLUDE_PATHS` **acrescenta** padrões a esta lista — nunca substitui. Os padrões de fábrica mantêm arquivos gerados fora das métricas de linhas +/−:

```text
package-lock.json   pnpm-lock.yaml      yarn.lock          bun.lock
bun.lockb           Cargo.lock          composer.lock      Gemfile.lock
poetry.lock         Pipfile.lock        pubspec.lock       Package.resolved
go.sum              *.min.js            *.min.css          *.min.map
*.snap              *.generated.ts      *.generated.js     *.designer.cs
```

Sem eles, um commit `chore: update version` arrasta +300k de lockfile para os números e distorce todos os gráficos. Exemplo:

```bash
GITVIEW_EXCLUDE_PATHS='themes/**/vendor/**,docs/api/**'
```

Só os commits escaneados *depois* da mudança respeitam os globs novos — para reaplicá-los ao histórico coletado, limpe e colete de novo (`pnpm clean && pnpm collect`, ver [Manutenção dos dados](./maintenance.md)).

:::info Por que o timezone vive no .env?
Todo bucket de tempo (dia, mês, semana ISO, fim de semana, madrugada, heatmap) é calculado em um fuso IANA canônico em vez do relógio da máquina que coleta. Assim o mesmo banco produz os mesmos buckets em qualquer máquina, e um colega em outro fuso lendo os mesmos dados vê gráficos idênticos — ver [issue #8](https://github.com/Enlighten-Brasil/gitview/issues/8).
:::

## Vindo do config.json / config.local.json legado

Releases antigos guardavam a config em um `config.json` versionado (aliases, org, exclusões) mais um `config.local.json` gitignored (token, raiz dos repos, perfis, times). A migração para o formato atual é **única e idempotente**, roda automaticamente na primeira vez que `loadConfig()` encontra um `config.local.json`, e roteia cada campo para o lugar novo:

| campo legado | novo lugar |
|---|---|
| `githubToken`, `reposRoot` (do `config.local.json`) | `.env` (variáveis do shell ainda vencem) |
| `githubOrg`, `oauthClientId`, `defaultRepos`, `exclude` (do `config.json`) | `.env` |
| `authors`, `githubUsers`, `devProfiles`, `teams`, `bots`, `githubBots` | `team.local.json` (aliases fundidos sem duplicar) |

Depois de migrar, o `config.local.json` é renomeado para `config.local.json.migrated` (histórico preservado, continua gitignored) e a migração vira no-op.

:::warning
Se a sua máquina ainda tem os arquivos antigos, rode `pnpm dev` **antes** de dar pull no release que removeu o `config.json` — a migração precisa do arquivo antigo no lugar. Se der pull primeiro, nada se perde: remapeie os aliases na tela [`/teams`](./team.md).
:::

## Próximos passos

- [Config do time (`team.local.json`)](./team.md) — perfis de devs, aliases, times e bots.
- [Manutenção dos dados](./maintenance.md) — o que é regenerável e como zerar.
