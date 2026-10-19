---
title: O arquivo .env
description: "As chaves GITVIEW_* do .env: defaults, precedência entre shell e arquivo, e o formato de cada valor."
---

# O arquivo `.env`

O `.env` guarda a config da máquina: credenciais do GitHub, onde estão os clones, o que ignorar e que fuso os gráficos usam. É gitignored, tem o único segredo do projeto (`GITVIEW_GITHUB_TOKEN`) e é criado do `.env.example` na primeira execução de `pnpm dev`, `pnpm start` ou de qualquer coletor.

## GitHub

| chave | o que faz | default |
|---|---|---|
| `GITVIEW_GITHUB_CLIENT_ID` | habilita **Conectar com GitHub** | `Ov…` de exemplo no template |
| `GITVIEW_GITHUB_TOKEN` | token usado na coleta | vazio → `gh auth token` |
| `GITVIEW_GITHUB_ORG` | org default do setup | vazio |

- Client ID é público: o device flow não usa client secret. Sem ele, cole um PAT ou use o `gh` logado, ver [Conectando o GitHub](../guide/connecting-github.md).
- O token fica em texto puro no `.env`: o arquivo está no `.gitignore` e o dev server recusa servi-lo.
- `GITVIEW_GITHUB_ORG` também é a org sugerida em **importar do GitHub** na tela `/teams`.

## Repositórios

| chave | o que faz | default |
|---|---|---|
| `GITVIEW_REPOS_ROOT` | pasta com os clones dos repos | vazio → `data/repos` |
| `GITVIEW_DEFAULT_REPOS` | repos pré-selecionados no setup | vazio → todos os não arquivados |
| `GITVIEW_PRODUCTION_REF` | branch tratada como produção | vazio → auto por repo |
| `GITVIEW_INTEGRATION_REFS` | branches de integração (CSV) | `develop,staging` |

- Chaves de lista são CSV, separadas por vírgula e sem espaços nas bordas: `GITVIEW_DEFAULT_REPOS=repo-a, repo-b`.
- `GITVIEW_REPOS_ROOT` aceita absoluto ou relativo à raiz do projeto. Em Windows use barras normais (`C:/dev/repos/api`).
- O setup grava a chave ao terminar o clone. Para ler clones que você mantém, veja [Repositórios](../guide/repositories.md).
- `GITVIEW_PRODUCTION_REF` é global com fallback por repo: quando o ref não existe num clone, aquele repo cai para a detecção automática (`origin/HEAD` → `HEAD` → `main` → `master`) e um aviso nomeia o repo. Repo com commits e sem ref de produção resolvível é erro, nunca vazio silencioso.
- `GITVIEW_INTEGRATION_REFS` é filtrada por repo: branches ausentes do clone saem da lista daquele repo. Resultado vazio é legítimo e não imprime nada.
- As duas chaves de refs também são editáveis pelo app: o card **Refs dos repositórios** em **Config → Geral** (só no dev server) grava as chaves no `.env` e mostra, como hint somente-leitura, o valor resolvido por repo — o que a coleta vai usar de fato, incluindo os fallbacks por repo.

## Branches

| chave | o que faz | default |
|---|---|---|
| `GITVIEW_BRANCH_STALE_DAYS` | dias sem atividade para uma branch sem commits à frente da produção (`aheadProd = 0`) ser classificada como `pousada` no `branches.json` | `30` |
| `GITVIEW_BOT_BRANCHES` | nomes exatos de branches de bot (CSV) | vazio → só o padrão de prefixo |

- O `collect-branches.ts` dá a cada branch exatamente um status de uma union fechada: `production`, `integration`, `feature`, `bot` ou `pousada`. Branches de bot casam com o prefixo `dependabot/` ou `renovate/` (`BOT_BRANCH_RE` em `scripts/lib/team.ts`); `GITVIEW_BOT_BRANCHES` acrescenta nomes exatos, comparados sem diferenciar maiúsculas. *Logins* de bot do GitHub (`githubBots` no `team.local.json`) casam logins, não nomes de ref — não classificam branches.
- `GITVIEW_BRANCH_STALE_DAYS` aceita inteiro ≥ 0; vazio ou inválido cai no default 30, que casa com o ciclo mensal de release. `pousada` também exige `aheadProd = 0` — branch velha com commits à frente da produção continua `feature`.
- O `branches.json` é fato puramente git: `authorsAhead` leva e-mails crus de commit (`%ae`), nunca nomes canônicos, e as linhas somam o numstat cru. Edição de alias/time reflete sem recoletar — o frontend mapeia e-mail→dev via `team.json#devs[].emails`.

## Métricas e dados

| chave | o que faz | default |
|---|---|---|
| `GITVIEW_TIMEZONE` | fuso de todos os buckets de tempo | `America/Sao_Paulo` |
| `GITVIEW_EXCLUDE_PATHS` | globs somados às exclusões de linhas | vazio → só a lista de fábrica |

- `GITVIEW_TIMEZONE` é nome IANA (`Europe/Lisbon`, `UTC`). Dia, mês, semana ISO, madrugada e heatmap saem dele, não do relógio da máquina. Fuso inválido imprime aviso e volta para `America/Sao_Paulo`.
- `GITVIEW_EXCLUDE_PATHS` **acrescenta** à lista de fábrica, nunca substitui: `GITVIEW_EXCLUDE_PATHS='themes/**/vendor/**,docs/api/**'`. Vale só para commits escaneados depois da mudança. Para o histórico, [limpar e recoletar](./maintenance.md).

Esses arquivos gerados ficam fora das métricas de linhas +/− (os commits deles contam):

```text
package-lock.json  pnpm-lock.yaml  yarn.lock  bun.lock  bun.lockb
Cargo.lock  composer.lock  Gemfile.lock  poetry.lock  Pipfile.lock
pubspec.lock  Package.resolved  go.sum
*.min.js  *.min.css  *.min.map  *.snap  *.generated.ts  *.generated.js  *.designer.cs
```

## Como os valores são resolvidos

- **shell → `.env` → default.** A variável do shell vence. Vazio ou só espaços contam como não definido; `GITVIEW_GITHUB_ORG=` é "a chave existe, desligada".
- O `.env` é relido a cada execução de coletor: token trocado vale na próxima coleta, sem reiniciar. `GITVIEW_PORT` é a exceção, lida no boot.
- Chave nova do `.env.example` que falta no seu `.env` gera um aviso (1× por processo): `! .env sem chaves novas do .env.example: ...`. Copie a linha, ou apague o `.env` e rode qualquer coletor para recriá-lo do template.
- A UI grava linha a linha e preserva comentários e ordem, com o valor entre aspas simples (`GITVIEW_REPOS_ROOT='C:/dev/my repos'`). O parser não expande escapes dentro de aspas simples. Valor com aspa simples ou quebra de linha é recusado.
- Dados de time não caem aqui: vão para o [`team.local.json`](./team.md).

## Ajustes avançados

- `GITVIEW_EXCLUDE`: pastas ignoradas na descoberta de repos. Casa o nome exato da subpasta, não é glob (`node_modules, tmp`). Default vazio.
- `GITVIEW_PORT`: porta do dev server, default `5173`. Aceita inteiro de 1 a 65535; fora disso é ignorado. Mudar exige reiniciar o `pnpm dev`.

## Próximos passos

- [Config do time (`team.local.json`)](./team.md): perfis, aliases, times e bots.
- [Manutenção dos dados](./maintenance.md): o que é regenerável e como zerar.
