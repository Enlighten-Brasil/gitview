# AGENTS.md — gitview

Dashboard interno do gestor de dev para acompanhar commits, PRs e releases do time nos repositórios da org do GitHub. Qualquer pessoa que clona roda `pnpm install && pnpm dev` — a config de máquina vive no `.env` (criado do `.env.example`) e o cadastro do time no `team.local.json` (gitignored); nada pessoal/Enspace é versionado. Ferramenta **read-only** sobre os dados — nunca escreve nos repos analisados.

## Arquitetura

```
git log  →  data/gitview.db (node:sqlite, incremental)  →  public/data/stats.json + commits.json
API GraphQL do GitHub (token .env/gh)  →  public/data/github.json (PRs + reviews)
git tag + API REST do GitHub  →  public/data/releases.json (tags + notas de release)
team.local.json + stats/github  →  team.json (devs + times + candidatos)
public/data/*.json     →  check-data.ts (valida os shapes no fim da coleta; falha = coleta falha)
```

O frontend (Vue 3 + TS + Vite + ECharts + Nuxt UI v4 / Tailwind v4) é **100% estático**: só lê os JSONs de `public/data/`, nada é recalculado do git no navegador. `public/data/*` e `data/` são gitignored — sempre regenerados pelos coletores.

### Coletores (`scripts/`)

| script | saída | fonte |
|---|---|---|
| `collect.ts` | `stats.json` (agregados weekly/monthly/heatmap por mês/monthlyTypes/perAuthor/perRepo/repoUrls) + `commits.json` (100 últimos/autor) | `git log --all --numstat --since=<watermark-7d>` → SQLite (`INSERT OR IGNORE`, incremental; `--full` = re-scan) |
| `collect-github.ts` | `github.json` (PRs OPEN todos + MERGED últimos 400d, reviews inline, mapa login→dev) | API GraphQL do GitHub via `fetch` (`ghGraphql` em lib/github.ts, token do `.env`/`gh auth token`) — incremental: refetch só de PRs atualizados desde a última coleta, merge com o JSON anterior; `--full` ignora o cache |
| `collect-releases.ts` | `releases.json` (tags com data, commits entre tags, não liberados, notas do GitHub) | `git tag` + API REST do GitHub (`ghApi`; sem token → só tags) |
| `collect-team.ts` | `team.json` (devs: perfil título/descrição + e-mails + logins + times; times; candidatos sem mapeamento) | `team.local.json` (`devProfiles`/`teams`/bots) + stats/github.json já gerados |
| `check-data.ts` | — (só valida; exit 1 em shape inválido) | lê os 5 JSONs de `public/data/`; asserts de estrutura + invariantes do team (membro órfão, candidato bot/ghost, nome duplicado) |

Os 3 coletores de dados processam os repos em paralelo (pool de 4). Logins do GitHub → nomes canônicos via `devProfiles` (mapeamento **explícito**, não fuzzy). Bots: `DEFAULT_GITHUB_BOTS` (lib/team.ts) + `githubBots`/`bots` do `team.local.json`. Aliases efetivos = `devProfiles[nome].emails` + `.githubLogins` — merge em `scripts/lib/team.ts` (`resolveAliases`), usado por collect.ts e collect-github.ts.

Config dos coletores (`scripts/lib/config.ts`): merge do `.env` (gitignored, criado do `.env.example` na 1ª execução; chaves `GITVIEW_*` — token, client id, org, `reposRoot`, defaultRepos, exclude, porta) + `team.local.json` (devProfiles/teams/bots). Precedência: shell > `.env` > default. `saveConfig()` roteia cada campo para o lugar certo (`.env` linha-a-linha preservando comentários, valores `'single-quoted'`; `team.local.json` JSON). O arquivo é relido **a cada chamada** (`envDir: false` no Vite — o dev server não carrega nem vigia `.env`, senão o setup mataria o SSE próprio ao gravar o token). `reposRoot` resolve: shell → `.env` → `data/repos`; se nada existir, erro com instruções (ver README). Migração única (`scripts/lib/legacy.ts`, disparada por `loadConfig`): `config.json`/`config.local.json` antigos viram `.env` + `team.local.json` e o local é renomeado `.migrated`.

O setup (`scripts/setup.ts` CLI e a UI) usa `GITVIEW_GITHUB_ORG`/`GITVIEW_DEFAULT_REPOS` do `.env`: lista os repos via API REST, clona os escolhidos em `data/repos/` (**bare**, gitignored) e grava `GITVIEW_REPOS_ROOT=data/repos` no `.env`. Clones gerenciados recebem `git fetch --all --prune --tags` no início do `collect.ts` — o token é injetado por `GIT_CONFIG_COUNT/KEY/VALUE` (só no processo do comando; nada de token no argv nem no config do clone; `scrubPersistedToken` limpa headers gravados por versões antigas) — e `denyPush` (`remote.origin.pushurl=no-push`), trava read-only no nível do git, idempotente, aplicada no clone e a cada coleta. Discovery compartilhada em `scripts/lib/repos.ts` (aceita checkout normal e bare; `isManagedRepo` identifica os clones do setup).

Limpeza: `scripts/lib/clean.ts` (`cleanLocalData`) apaga banco + `public/data/*.json` (tudo regenerável; clones só com flag — **nunca** apaga `.env`/`team.local.json`, que não são regeneráveis) — usada pelo `pnpm clean` (`scripts/clean.ts`) e pelo `/__collect?clean=1`.

`scripts/lib/github.ts` centraliza o acesso HTTP à API do GitHub (coletores **e** setup): `getToken()` (`GITVIEW_GITHUB_TOKEN` do `.env`/shell → `gh auth token`; o **gh CLI é ponte opcional**, ninguém precisa dele instalado pra coletar), REST (`ghApi`/`ghApiAll` — path com `/` inicial), `ghGraphql`, `currentUser`, `listOrgs`, `listOrgMembers`/`listOrgTeams`, `listOrgRepos`/`listUserRepos` e o **device flow** (`deviceStart`/`devicePoll`, sem client secret). O device flow aceita **GitHub App** (client_id `Iv…` — sem scope, o token herda as permissões do app; recomendado: *Contents read-only* = token fisicamente read-only) e **OAuth App** (`Ov…`/hex — scope `repo read:org`, read+write; mitigado pelo `denyPush`). O `cloneBare`/`fetchRepo` autenticam via `gitAuthEnv` (Basic `x-access-token` serve pra PAT/OAuth/GitHub App), sem gravar segredo em disco.

### Setup pela UI (dev only)

`scripts/setup-plugin.ts` é um plugin Vite (`apply: 'serve'`) que alimenta a rota `/setup` (`views/SetupView.vue` + `src/setup.ts`). A página tem **2 modos**: sem dados é o **wizard de 3 passos** (conectar GitHub → escolher org/repos → clonar e coletar); com dados cai direto numa tela **Configurações** (chips dos repos atuais + gerenciar repositórios, manutenção — recoletar/limpar, conta GitHub — trocar de conta). Gerenciar repos abre a lista pré-selecionada com os repos atuais (badge "atual"); desmarcar um atual mostra alerta de remoção e o apply apaga o clone do disco. Endpoints (todos dev only):

- `GET /__setup/status` — auth (user + fonte do token), `oauthConfigured`, `reposRoot`, repos gerenciados, `hasData`. Sondado a cada 5s enquanto a tela de auth está aberta (detecta `gh auth login` e troca de conta — volta às configurações quando o login muda).
- `GET /__auth/device` — inicia o device flow (só se `GITVIEW_GITHUB_CLIENT_ID` no `.env`); `POST /__auth/device/poll` — conclui e grava o token no `.env`. **Ordem importa**: o poll é registrado ANTES no connect, que casa middleware por prefixo (`/__auth/device` engoliria `/poll`).
- `POST /__auth/token` — PAT colado na UI: valida em `GET /user` **antes** de gravar no `.env` (401 com mensagem se o token não presta); `POST /__auth/logout` — limpa a chave (`GITVIEW_GITHUB_TOKEN=`; se o gh estiver logado ele reassume a ponte, e o status reflete).
- `GET /__setup/orgs` — orgs do usuário + entrada `@user` (repos pessoais); `GET /__setup/repos?org=` — payload enxuto (`name`, `archived`, `pushed_at`, `private`).
- `GET /__setup/apply?org=&repos=a,b&dry=1&remove=c,d` — SSE com lock: remove os clones listados em `remove` (só gerenciados, nome sanitizado), clona os faltantes (pool de 4; exige token), grava `reposRoot` no `.env`; `?dry=1` valida sem efeitos. Remoção é sempre explícita (nunca prune por diferença de lista).
- `GET /__clean[?repos=1]` — apaga banco + JSONs sem recoletar (com `repos=1`, apaga também os clones) — mesma lib do `pnpm clean`; é o botão "apagar dados" (volta ao wizard; o `/` redireciona por causa do gate).
- `GET /__team/github` — membros + times da org (`githubOrg`) via REST (para importar). Requer token com `read:org`; falha parcial (ex.: sem permissão → times vazio) vem no campo `warnings` (a UI mostra no modal de import).
- `GET/POST /__team/config` — lê/grava `devProfiles` + `teams` no `team.local.json` (sanitização de payload em `sanitizeDevProfiles`/`sanitizeTeams`).

### Time pela UI (rota `/team`)

`views/TeamView.vue` + `src/team.ts`: página fora do dashboard pra gerenciar **times** (nome, descrição, cor, membros) e **perfis de devs** (título, descrição, e-mails de commit, logins do GitHub extras). Persiste em `team.local.json` via `/__team/config` (só a máquina — dados de gestão não versionados). Botão **importar do GitHub** traz times e membros da org (`/__team/github`); times importados resolvem logins→devs pelos aliases já mapeados. A seção **Sem mapeamento** lista autores do git e logins do GitHub vistos nos dados sem alias (do `team.json#candidates`) e associa a um dev — a unificação vale na coleta seguinte (`resolveAliases`). "Salvar + recoletar" roda a coleta completa (`startCollect(true)`) pra reescrever stats/github com os novos nomes — só se o salvar der certo. No build estático a página é somente leitura (endpoints dev only) — devs **e times** são renderizados do `team.json` (times entram no editor via seed no `onMounted`, já que `/__team/config` não existe). Bot de perfil não entra em `devNames` (não é alvo de associação).

Gate de primeira execução: `App.vue` redireciona `/` → `/setup` quando o `stats.json` dá 404 em dev; sidebar de filtros é oculta nas rotas `/setup` e `/team`. Botões no navbar: 👥 `/team` (também no build estático) e ⚙ `/setup` (dev only). O passo 1 de auth oferece device flow (com Client ID no `.env`), colar PAT ou a ponte do `gh auth login` (detectado via sonda).

A tela Configurações tem o card **Manutenção dos dados locais** com 3 ações: *recoletar tudo* (`startCollect(true)`), *limpar e recoletar* (wipe + full, `startCollect(false, true)` via `/__collect?clean=1`) e *apagar dados* (confirmação inline com checkbox de clones → `/__clean`; sem dados o gate leva de volta ao wizard).

### Coleta pela UI (dev only)

`scripts/collect-plugin.ts` é um plugin Vite (`apply: 'serve'`) que expõe `GET /__collect` (SSE; `?full=1` = completo; `?clean=1` apaga banco + JSONs antes e implica full) rodando os 4 coletores + `check-data` com progresso ao vivo. O botão ↻ no navbar (`App.vue` + `src/collect.ts` — `startCollect(full, clean)`) só renderiza em `import.meta.env.DEV`; após o `done`, os loaders refazem o fetch com cache-bust (`loadStats/loadGithub/loadReleases/loadCommits/loadTeam` aceitam `force`). No build estático o endpoint não existe.

## Comandos

```bash
pnpm collect            # os 4 coletores em sequência + check-data no fim
pnpm collect:github     # só PRs
pnpm collect:releases   # só releases
pnpm check:data         # só a validação de shape dos JSONs
pnpm typecheck          # tsc --noEmit (scripts + src; templates .vue fora)
pnpm dev                # http://localhost:5173 (Vite)
pnpm start              # alias do dev (setup/coleta só existem no dev server)
pnpm build              # dist estático
pnpm changeset          # registrar mudança
pnpm version:packages   # aplicar changesets (bumps + CHANGELOG)
```

## Convenções obrigatórias

- **Toda mudança** = changeset (`minor` feature / `patch` fix) → `pnpm version:packages` → commit único com `chore(release): X.Y.Z` no corpo. Versão atual: ver `package.json` / `CHANGELOG.md`.
- **Commits em pt-BR** (Conventional Commits), código em inglês, comentários em pt-BR.
- **Windows / PowerShell 5.1**: usar `pnpm.cmd` (o shim `pnpm.ps1` é bloqueado pela Execution Policy). **Nunca** editar arquivos UTF-8 via PowerShell (mojibake) — usar as ferramentas de edição. **Nunca** piper CLI que muta arquivos com `2>&1 | Select-Object` (pode abortar no meio).
- ESLint `@antfu/eslint-config`: sem ponto-e-vírgula, aspas simples.
- Deleção de arquivos: `rm -- <path>` (launcher recuperável), nunca `Remove-Item`.

## Estrutura do `src/`

- `data.ts` — filtros globais (`filters`), agregações filtradas (monthly/weekly/heatmap/types), totais + delta (`previousTotals`), ritmo (`pace`), burnout, off-hours por período.
- `github.ts` — PRs filtrados, aging, cycle time (mediana geral/por repo/tendência 6M), reviews por dev e concentração por repo, merge sem review.
- `releases.ts` — loader do releases.json + métricas (dias desde última release, cadência).
- `urlState.ts` — aba + filtros na query string (`?tab=&range=&from=&to=&repos=&devs=&bots=`), replaceState, popstate com reset, sanitização, fallback localStorage. **Escopo por rota**: tab/repos/devs só no dashboard (`/`); período (range/from/to) + bots também em `/dev/:name` e `/repo/:name`; demais rotas (ex.: `/setup`) são ignoradas. Navegação por link preserva o contexto (afterEach aplica os params presentes sem resetar e regrava a query da rota).
- `summary.ts` — resumo semanal exportável (markdown da última semana ISO fechada vs anterior). **Ignora os filtros da sidebar e sempre exclui bots** — é relatório do time inteiro, pra reunião. UI: `components/WeeklySummary.vue` (slideover com copiar/baixar .md, botão no navbar).
- `chartTheme.ts` — tema ECharts com conversão oklch→hex (proxy `ct`).
- `echarts.ts` — registro central dos módulos ECharts usados (`echarts/core` + `use([...])`). Só `ChartPanel.vue` (o único componente com gráfico) importa isso + `VChart` — echarts entra apenas nos chunks das rotas que renderizam gráficos.
- `main.ts` — rotas com `defineAsyncComponent` + dynamic import (code-split por rota; só `/` puxa echarts). `vite-env.d.ts` dá o shim `*.vue` pro `tsc` dos scripts.
- `setup.ts` — cliente do setup: status/auth device flow/orgs/repos e SSE do `/__setup/apply` (`startSetupApply(org, repos, { dry?, remove? })`, refs `setupApplying/setupLog/setupError/setupDone`). Só existe em dev.
- `views/` — `DashboardView` (5 abas: Visão geral, Time, Saúde, Repos, Pull requests), `DevView` (`/dev/:name`), `RepoView` (`/repo/:name`), `SetupView` (`/setup`, dev only — wizard de onboarding + tela de configurações), `TeamView` (`/team` — perfis/aliases/times; edição dev only).
- `components/` — um componente por painel; tabelas usam a classe `.data-table` (ver `main.css`).
- `App.vue` — navbar com badge de frescor dos dados (`dataAge`: warning após 24h sem coleta), botão do resumo semanal, coleta (dev only) e ⚙ setup (dev only); gate que redireciona para `/setup` na primeira execução sem dados.

## Regras dos filtros (importante pra não "corrigir" o que é intencional)

- Filtro de período: presets (1/3/6/12/24M, Tudo) **ou** range custom `dateFrom/dateTo` (YYYY-MM-DD, prevalece sobre preset, corta **por mês inteiro** — a agregação é mensal/semanal). Delta dos cards é omitido em range custom e em "Tudo".
- Janelas fixas intencionais (ignoram o período, estão rotuladas no rodapé): Ritmo (4 vs 8 semanas), BurnoutWatch (8 semanas), Tendência de cycle time (6 meses), PRs abertos ("agora"), Ranking do time (histórico completo).
- **Páginas `/dev/:name` e `/repo/:name` respeitam o filtro de período** (desde 0.27.0): cards de commits/linhas/devs, gráficos, PRs mergeados, cycle time, reviews e lista de commits ficam restritos ao período; "Tudo" = histórico completo. Ficam fora do período por decisão: dias ativos/streak/repos (rotulados `(total)`), PRs abertos ("agora") e releases (marcos). Heatmap de horários em "Tudo" cobre no máximo 24M (limite da agregação). Na sidebar, essas rotas mostram **só o seletor de período** (+ switch de bots em `/repo`, que passa a valer para commits/tipos/PRs do repo).
- Thresholds dos painéis de Saúde estão documentados no rodapé de cada card.

## Validação

- Validar no Chrome via chrome-devtools MCP em `http://localhost:5173`. O modelo não lê imagens — validar por DOM/`evaluate_script` (textos, tabelas, valores) e checar console.
- Tabs do Reka UI **não respondem a `.click()` sintético** — usar o `click` real do MCP com o uid do snapshot, ou navegar pela URL (`?tab=...`).
- Não há suite de testes; `pnpm build` (vite) é o check de compilação, `pnpm typecheck` o de tipos (templates `.vue` ficam fora — shim manual em `src/vite-env.d.ts`), `pnpm check:data` o dos dados gerados (já roda no fim do `pnpm collect` e como 5º passo do `/__collect`).
