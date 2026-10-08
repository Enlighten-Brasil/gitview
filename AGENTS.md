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

Os 3 coletores processam os repos em paralelo (pool de 4). Logins do GitHub → nomes canônicos via `config.githubUsers` (mapeamento **explícito**, não fuzzy). Bots: `config.githubBots` + `config.bots`.

Config dos coletores (`scripts/lib/config.ts`): merge de `config.json` (versionado, **agnóstico de máquina** — mapeamentos e defaults do time) + `config.local.json` (gitignored, dados da máquina: `reposRoot`, `githubToken`). `saveLocalConfig()` grava no local. `reposRoot` resolve nesta ordem: env `GITVIEW_REPOS_ROOT` → config (na prática o local) → auto-detect `../enspace`; se nada existir, erro com instruções (ver README). `authors`/`githubUsers`/`githubBots` são opcionais — sem eles nada quebra, só não há merge de aliases.

`githubOrg` + `defaultRepos` (config.json) alimentam o `pnpm setup` (`scripts/setup.ts`): wizard que lista os repos da org via `gh`, clona os escolhidos em `data/repos/` (**bare**, gitignored) e grava `reposRoot` no config.local.json. Clones gerenciados recebem `git fetch --all --prune --tags` no início do `collect.ts`. Discovery compartilhada em `scripts/lib/repos.ts` (aceita checkout normal e bare; `isManagedRepo` identifica os clones do setup).

`scripts/lib/github.ts` centraliza o acesso à API do GitHub **para o setup**: `getToken()` (`config.local.json#githubToken` → `gh auth token`), REST com paginação (`ghApiAll`), `currentUser`, `listOrgs`, `listOrgRepos`/`listUserRepos` e o **device flow** (`deviceStart`/`devicePoll`, escopo `repo read:org`, sem client secret). O `cloneBare` aceita token: persiste `http.https://github.com/.extraheader` no config do clone (autentica os fetches futuros sem `gh`). Os **coletores** seguem usando `gh api` (não passam por essa lib).

### Setup pela UI (dev only)

`scripts/setup-plugin.ts` é um plugin Vite (`apply: 'serve'`) que alimenta a rota `/setup` (`views/SetupView.vue` + `src/setup.ts`): wizard de 3 passos (conectar GitHub → escolher org/repos → clonar e coletar). Endpoints (todos dev only):

- `GET /__setup/status` — auth (user + fonte do token), `oauthConfigured`, `reposRoot`, repos gerenciados, `hasData`. Sondado a cada 5s pelo passo 1.
- `GET /__auth/device` — inicia o device flow (só se `oauthClientId` configurado no config.json); `POST /__auth/device/poll` — conclui e grava o token no config.local.json.
- `GET /__setup/orgs` — orgs do usuário + entrada `@user` (repos pessoais); `GET /__setup/repos?org=` — payload enxuto (`name`, `archived`, `pushed_at`, `private`).
- `GET /__setup/apply?org=&repos=a,b&dry=1` — SSE com lock: clona os faltantes (pool de 4), grava `reposRoot`; `?dry=1` valida sem efeitos.

Gate de primeira execução: `App.vue` redireciona `/` → `/setup` quando o `stats.json` dá 404 em dev; sidebar de filtros é oculta na rota `/setup`. Botão ⚙ no navbar (dev only) abre o wizard. Sem `oauthClientId`, o passo 1 orienta `gh auth login` (a UI detecta a sessão via sonda).

### Coleta pela UI (dev only)

`scripts/collect-plugin.ts` é um plugin Vite (`apply: 'serve'`) que expõe `GET /__collect` (SSE; `?full=1` = completo) rodando os 3 coletores com progresso ao vivo. O botão ↻ no navbar (`App.vue` + `src/collect.ts`) só renderiza em `import.meta.env.DEV`; após o `done`, os loaders refazem o fetch com cache-bust (`loadStats/loadGithub/loadReleases/loadCommits` aceitam `force`). No build estático o endpoint não existe.

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
- `urlState.ts` — aba + filtros na query string (`?tab=&range=&from=&to=&repos=&devs=&bots=`), replaceState, popstate com reset, sanitização, fallback localStorage. **Só atua na rota `/`**.
- `summary.ts` — resumo semanal exportável (markdown da última semana ISO fechada vs anterior). **Ignora os filtros da sidebar e sempre exclui bots** — é relatório do time inteiro, pra reunião. UI: `components/WeeklySummary.vue` (slideover com copiar/baixar .md, botão no navbar).
- `chartTheme.ts` — tema ECharts com conversão oklch→hex (proxy `ct`).
- `setup.ts` — cliente do wizard de setup: status/auth device flow/orgs/repos e SSE do `/__setup/apply` (refs `setupApplying/setupLog/setupError/setupDone` + `startSetupApply`). Só existe em dev.
- `views/` — `DashboardView` (5 abas: Visão geral, Time, Saúde, Repos, Pull requests), `DevView` (`/dev/:name`), `RepoView` (`/repo/:name`), `SetupView` (`/setup`, dev only — wizard de onboarding).
- `components/` — um componente por painel; tabelas usam a classe `.data-table` (ver `main.css`).
- `App.vue` — navbar com badge de frescor dos dados (`dataAge`: warning após 24h sem coleta), botão do resumo semanal, coleta (dev only) e ⚙ setup (dev only); gate que redireciona para `/setup` na primeira execução sem dados.

## Regras dos filtros (importante pra não "corrigir" o que é intencional)

- Filtro de período: presets (1/3/6/12/24M, Tudo) **ou** range custom `dateFrom/dateTo` (YYYY-MM-DD, prevalece sobre preset, corta **por mês inteiro** — a agregação é mensal/semanal). Delta dos cards é omitido em range custom e em "Tudo".
- Janelas fixas intencionais (ignoram o período, estão rotuladas no rodapé): Ritmo (4 vs 8 semanas), BurnoutWatch (8 semanas), Tendência de cycle time (6 meses), PRs abertos ("agora"), Ranking do time e páginas /dev e /repo (histórico completo; heatmap de horários cobre no máximo 24M — limite da agregação).
- Thresholds dos painéis de Saúde estão documentados no rodapé de cada card.

## Validação

- Validar no Chrome via chrome-devtools MCP em `http://localhost:5173`. O modelo não lê imagens — validar por DOM/`evaluate_script` (textos, tabelas, valores) e checar console.
- Tabs do Reka UI **não respondem a `.click()` sintético** — usar o `click` real do MCP com o uid do snapshot, ou navegar pela URL (`?tab=...`).
- Não há suite de testes; `pnpm build` (vite) é o check de compilação.
