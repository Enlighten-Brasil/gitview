# AGENTS.md — gitview

Dashboard interno do Raul (gestor de dev) para acompanhar commits, PRs e releases do time nos 12 repositórios do Enspace (`C:/Users/Raul/Documents/GitHub/enspace`). Ferramenta **read-only** sobre os dados — nunca escreve nos repos analisados.

## Arquitetura

```
git log  →  data/gitview.db (node:sqlite, incremental)  →  public/data/stats.json + commits.json
gh api graphql  →  public/data/github.json (PRs + reviews)
git tag + gh api REST  →  public/data/releases.json (tags + notas de release)
```

O frontend (Vue 3 + TS + Vite + ECharts + Nuxt UI v4 / Tailwind v4) é **100% estático**: só lê os JSONs de `public/data/`, nada é recalculado do git no navegador. `public/data/*` e `data/` são gitignored — sempre regenerados pelos coletores.

### Coletores (`scripts/`)

| script | saída | fonte |
|---|---|---|
| `collect.ts` | `stats.json` (agregados weekly/monthly/heatmap por mês/monthlyTypes/perAuthor/perRepo/repoUrls) + `commits.json` (100 últimos/autor) | `git log --all --numstat --since=<watermark-7d>` → SQLite (`INSERT OR IGNORE`, incremental; `--full` = re-scan) |
| `collect-github.ts` | `github.json` (PRs OPEN todos + MERGED últimos 400d, reviews inline, mapa login→dev) | `gh api graphql` (requer `gh auth`) — incremental: refetch só de PRs atualizados desde a última coleta, merge com o JSON anterior; `--full` ignora o cache |
| `collect-releases.ts` | `releases.json` (tags com data, commits entre tags, não liberados, notas do GitHub) | `git tag` + `gh api` REST |
| `collect-team.ts` | `team.json` (devs: perfil título/descrição + e-mails + logins + times; times; candidatos sem mapeamento) | config (`devProfiles`/`teams` locais + `authors`/`githubUsers`) + stats/github.json já gerados |

Os 3 coletores de dados processam os repos em paralelo (pool de 4). Logins do GitHub → nomes canônicos via `config.githubUsers` (mapeamento **explícito**, não fuzzy). Bots: `config.githubBots` + `config.bots`. Aliases efetivos = `authors`/`githubUsers` **+** `devProfiles` (e-mails/logins extras) — merge em `scripts/lib/team.ts` (`resolveAliases`), usado por collect.ts e collect-github.ts; o local sobrescreve em conflito.

Config dos coletores (`scripts/lib/config.ts`): merge de `config.json` (versionado, **agnóstico de máquina** — mapeamentos e defaults do time) + `config.local.json` (gitignored, dados da máquina: `reposRoot`, `githubToken`, `devProfiles`, `teams`). `saveLocalConfig()` grava no local. `reposRoot` resolve nesta ordem: env `GITVIEW_REPOS_ROOT` → config (na prática o local) → auto-detect `../enspace`; se nada existir, erro com instruções (ver README). `authors`/`githubUsers`/`githubBots` são opcionais — sem eles nada quebra, só não há merge de aliases.

`githubOrg` + `defaultRepos` (config.json) alimentam o `pnpm setup` (`scripts/setup.ts`): wizard que lista os repos da org via `gh`, clona os escolhidos em `data/repos/` (**bare**, gitignored) e grava `reposRoot` no config.local.json. Clones gerenciados recebem `git fetch --all --prune --tags` no início do `collect.ts` — e `denyPush` (`remote.origin.pushurl=no-push`), trava read-only no nível do git, idempotente, aplicada no clone e a cada coleta. Discovery compartilhada em `scripts/lib/repos.ts` (aceita checkout normal e bare; `isManagedRepo` identifica os clones do setup).

Limpeza: `scripts/lib/clean.ts` (`cleanLocalData`) apaga banco + `public/data/*.json` (tudo regenerável; clones só com flag) — usada pelo `pnpm clean` (`scripts/clean.ts`) e pelo `/__collect?clean=1`.

`scripts/lib/github.ts` centraliza o acesso à API do GitHub **para o setup**: `getToken()` (`config.local.json#githubToken` → `gh auth token`), REST com paginação (`ghApiAll`), `currentUser`, `listOrgs`, `listOrgRepos`/`listUserRepos` e o **device flow** (`deviceStart`/`devicePoll`, sem client secret). O device flow aceita **GitHub App** (client_id `Iv…` — sem scope, o token herda as permissões do app; recomendado: *Contents read-only* = token fisicamente read-only) e **OAuth App** (`Ov…`/hex — scope `repo read:org`, read+write; mitigado pelo `denyPush`). O `cloneBare` aceita token: persiste `http.https://github.com/.extraheader` (**Basic** `x-access-token`, serve pra PAT/OAuth/GitHub App) no config do clone (autentica os fetches futuros sem `gh`). Os **coletores** seguem usando `gh api` (não passam por essa lib).

### Setup pela UI (dev only)

`scripts/setup-plugin.ts` é um plugin Vite (`apply: 'serve'`) que alimenta a rota `/setup` (`views/SetupView.vue` + `src/setup.ts`). A página tem **2 modos**: sem dados é o **wizard de 3 passos** (conectar GitHub → escolher org/repos → clonar e coletar); com dados cai direto numa tela **Configurações** (chips dos repos atuais + gerenciar repositórios, manutenção — recoletar/limpar, conta GitHub — trocar de conta). Gerenciar repos abre a lista pré-selecionada com os repos atuais (badge "atual"); desmarcar um atual mostra alerta de remoção e o apply apaga o clone do disco. Endpoints (todos dev only):

- `GET /__setup/status` — auth (user + fonte do token), `oauthConfigured`, `reposRoot`, repos gerenciados, `hasData`. Sondado a cada 5s enquanto a tela de auth está aberta (detecta `gh auth login` e troca de conta — volta às configurações quando o login muda).
- `GET /__auth/device` — inicia o device flow (só se `oauthClientId` configurado no config.json); `POST /__auth/device/poll` — conclui e grava o token no config.local.json. **Ordem importa**: o poll é registrado ANTES no connect, que casa middleware por prefixo (`/__auth/device` engoliria `/poll`).
- `GET /__setup/orgs` — orgs do usuário + entrada `@user` (repos pessoais); `GET /__setup/repos?org=` — payload enxuto (`name`, `archived`, `pushed_at`, `private`).
- `GET /__setup/apply?org=&repos=a,b&dry=1&remove=c,d` — SSE com lock: remove os clones listados em `remove` (só gerenciados, nome sanitizado), clona os faltantes (pool de 4), grava `reposRoot`; `?dry=1` valida sem efeitos. Remoção é sempre explícita (nunca prune por diferença de lista).
- `GET /__clean[?repos=1]` — apaga banco + JSONs sem recoletar (com `repos=1`, apaga também os clones) — mesma lib do `pnpm clean`; é o botão "apagar dados" (volta ao wizard; o `/` redireciona por causa do gate).
- `GET /__team/github` — membros + times da org (`githubOrg`) via REST (para importar). Requer token com `read:org`; falha parcial (ex.: sem permissão → times vazio) vem no campo `warnings` (a UI mostra no modal de import).
- `GET/POST /__team/config` — lê/grava `devProfiles` + `teams` no config.local.json (sanitização de payload em `sanitizeDevProfiles`/`sanitizeTeams`; `fixed` expõe os aliases do config.json como somente leitura).

### Time pela UI (rota `/team`)

`views/TeamView.vue` + `src/team.ts`: página fora do dashboard pra gerenciar **times** (nome, descrição, cor, membros) e **perfis de devs** (título, descrição, e-mails de commit, logins do GitHub extras). Persiste em `config.local.json` via `/__team/config` (só a máquina — dados de gestão não versionados). Botão **importar do GitHub** traz times e membros da org (`/__team/github`); times importados resolvem logins→devs pelos aliases já mapeados. A seção **Sem mapeamento** lista autores do git e logins do GitHub vistos nos dados sem alias (do `team.json#candidates`) e associa a um dev — a unificação vale na coleta seguinte (`resolveAliases`). "Salvar + recoletar" roda a coleta completa (`startCollect(true)`) pra reescrever stats/github com os novos nomes — só se o salvar der certo. No build estático a página é somente leitura (endpoints dev only) — devs **e times** são renderizados do `team.json` (times entram no editor via seed no `onMounted`, já que `/__team/config` não existe). Bot de perfil não entra em `devNames` (não é alvo de associação).

Gate de primeira execução: `App.vue` redireciona `/` → `/setup` quando o `stats.json` dá 404 em dev; sidebar de filtros é oculta nas rotas `/setup` e `/team`. Botões no navbar: 👥 `/team` (também no build estático) e ⚙ `/setup` (dev only). Sem `oauthClientId`, o passo 1 orienta `gh auth login` (a UI detecta a sessão via sonda).

A tela Configurações tem o card **Manutenção dos dados locais** com 3 ações: *recoletar tudo* (`startCollect(true)`), *limpar e recoletar* (wipe + full, `startCollect(false, true)` via `/__collect?clean=1`) e *apagar dados* (confirmação inline com checkbox de clones → `/__clean`; sem dados o gate leva de volta ao wizard).

### Coleta pela UI (dev only)

`scripts/collect-plugin.ts` é um plugin Vite (`apply: 'serve'`) que expõe `GET /__collect` (SSE; `?full=1` = completo; `?clean=1` apaga banco + JSONs antes e implica full) rodando os 4 coletores com progresso ao vivo. O botão ↻ no navbar (`App.vue` + `src/collect.ts` — `startCollect(full, clean)`) só renderiza em `import.meta.env.DEV`; após o `done`, os loaders refazem o fetch com cache-bust (`loadStats/loadGithub/loadReleases/loadCommits/loadTeam` aceitam `force`). No build estático o endpoint não existe.

## Comandos

```bash
pnpm collect            # os 3 coletores em sequência
pnpm collect:github     # só PRs
pnpm collect:releases   # só releases
pnpm dev                # http://localhost:5173 (Vite)
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
- Não há suite de testes; `pnpm build` (vite) é o check de compilação.
