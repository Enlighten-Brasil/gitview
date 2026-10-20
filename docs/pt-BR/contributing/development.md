---
title: Ambiente de desenvolvimento
description: Requisitos, todos os comandos do package.json, gates de PR, convenções e as armadilhas do Windows.
---

# Ambiente de desenvolvimento

O gitview é read-only sobre os repos analisados: os coletores leem `git log`, tags e a API do GitHub, e escrevem JSON em `public/data/`. PRs que proponham escrever nos repos analisados não são aceitos.

## Requisitos e primeiro run

- **Node 22.13+** (os coletores usam `node:sqlite`, sem flag desde a 22.13; o CI roda Node 22)
- **pnpm 11.28** (pinado no campo `packageManager`; `corepack enable` uma vez resolve)
- **Uma conta GitHub** (token no `.env` ou `gh auth login`)

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev        # http://localhost:5173; sem dados, cai no assistente /setup
```

O `.env` nasce do `.env.example` na primeira execução e o cadastro do time vive no `team.local.json`; ambos são gitignored. Para trabalhar sem a org real, aponte `GITVIEW_REPOS_ROOT` para clones seus: um token com acesso a uma org pública pequena basta.

O `pnpm-workspace.yaml` fixa `minimumReleaseAge: 1440` e só instala pacote publicado há pelo menos 24h. Um `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` num bump recente é esperado: espere a versão amadurecer ou liste-a em `minimumReleaseAgeExclude`.

## Comandos

Todos os scripts do `package.json`:

| Comando | O que faz |
|---|---|
| `pnpm setup` | assistente no terminal: escolher e clonar os repos da org |
| `pnpm collect` | os 6 coletores em sequência, mais `check:data` (incremental) |
| `pnpm collect:branches` | só o inventário de branches (`branches.json`) |
| `pnpm collect:full` | a mesma cadeia com `--full` (re-scan completo + refetch) |
| `pnpm collect:github` | só PRs e reviews |
| `pnpm collect:graph` | só a topologia do grafo de commits (`graph-*.json`) |
| `pnpm collect:reaggregate` | leve: re-agregação + PRs + time + `check:data` |
| `pnpm collect:releases` | só releases |
| `pnpm collect:team` | só o cadastro do time (`team.json`) |
| `pnpm check:data` | shape e invariantes dos JSONs; gate local de dados |
| `pnpm check:scrub` | tracked livres dos termos de identidade; gate de CI |
| `pnpm check:docs` | paridade EN e pt-BR das páginas; gate de CI |
| `pnpm clean` | apaga banco e JSONs; `-- --repos` inclui os clones |
| `pnpm dev` / `pnpm start` | dashboard em `http://localhost:5173` |
| `pnpm build` | build estático em `dist/`; gate de CI |
| `pnpm preview` | serve o `dist/` buildado localmente |
| `pnpm lint` | ESLint `@antfu/eslint-config`; gate de CI |
| `pnpm lint:fix` | lint com auto-fix |
| `pnpm typecheck` | `tsc --noEmit` em `scripts/` e `src/`; gate de CI |
| `pnpm docs:dev` | site de docs em dev (VitePress, `DOCS_BASE=/`) |
| `pnpm docs:build` | build do site de docs; gate de CI contra dead link |
| `pnpm docs:preview` | serve o site de docs buildado |
| `pnpm demo` | gera o fixture sintético da demo pública (nove JSONs, devs/repos fictícios) |
| `pnpm demo:shots` | regenera as capturas das docs do fixture sintético |
| `pnpm snapshot:metrics` | harness de regressão das agregações: JSON determinístico da matriz de cenários de filtros (abaixo) |
| `pnpm changeset` | registrar uma mudança; obrigatório em PR |
| `pnpm version:packages` | aplicar changesets (bump + `CHANGELOG.md`) |

## Gates antes do PR

Não há suíte de testes. Antes de abrir PR rode `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck` e `pnpm build`, mais `pnpm check:docs` quando mexeu em `docs/` ou em `docs/.vitepress/config.ts`. Rode `pnpm check:data` quando mexeu em coletores ou shapes de dados.

O CI (`.github/workflows/ci.yml`) roda scrub, lint, typecheck e build no job `gates`, e `check:docs` mais `docs:build` no job `docs`, em todo PR e em push para `main`. O `check:data` fica na sua máquina: `public/data/` é gitignored, só existe depois de uma coleta local com token.

## Convenções obrigatórias

- **Toda mudança de código vem com changeset**: `pnpm changeset` (`minor` = feature, `patch` = fix). PR de código sem changeset volta na revisão.
- **Commits em pt-BR**, Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `chore(release): ...`); código em inglês, comentários em pt-BR. Commit que fecha issue do roadmap termina o corpo com `Ref: #N`.
- **Formatação imposta pelo lint**: `@antfu/eslint-config`, sem ponto-e-vírgula, aspas simples. Não brigue com ele: `pnpm lint:fix`.
- **Copy de feedback**: ação com efeito emite toast (`useToast`) com título curto em inicial maiúscula e `color` explícita. Confirmação destrutiva sempre passa por `useConfirm()` (UModal): `title` é a pergunta, `description` é a consequência, `confirmLabel` é a ação. `window.confirm` e modal ad hoc são proibidos.
- **Feature que escreve config ou dados pela UI nasce atrás de `import.meta.env.DEV`** e degrada no build estático: a página segue renderizando os JSONs, só sem os controles de edição.
- **Deleção de arquivos**: `rm -- <path>` (launcher recuperável), nunca `Remove-Item`.

## Onde mora o quê no `src/`

- `data.ts`: filtros globais, agregações filtradas (monthly, weekly, heatmap, types), totais, delta, ritmo, fora do horário.
- `github.ts`: PRs filtrados, aging, cycle time, reviews por dev, merge sem review.
- `branches.ts`: loader do `branches.json` + join branch↔PR, status derivados (viva-sem-PR, pousada via squash) e os cards e a tabela de `/branches`.
- `graphData.ts` + `graph/`: o grafo de commits (`#grafo` de `/repos/:name`) — loader do `graph-REPO.json` por repo, algoritmo puro de lanes (`graph/lanes.ts`), cores de lane/ref (`graph/palette.ts`) e o reader tolerante de refs (`graph/refs.ts`).
- `releases.ts`: loader do `releases.json` e métricas de cadência.
- `urlState.ts`: filtros na query string (`?range=&from=&to=&repos=&devs=&bots=`), com escopo por `route.meta.filters`.
- `summary.ts`: resumo semanal em markdown, ignorando os filtros da sidebar.
- `router/`: `guards.ts` aplica o contrato de `route.meta` (`requiresData`, `onboarding`, `requiresServer`, `setupStep`, `section`, `filters`, `title`).
- `pages/`: uma rota por arquivo: shell `(app)/`, abas `(dashboard)/`, `devs/[name]`, `repos/`, `prs`, `teams`, `settings/` e `setup/` (dev only), `[...path].vue` para 404.
- `components/`: um componente por painel; tabelas usam a classe `.data-table`.

O pipeline completo e as regras dos filtros estão no `AGENTS.md` da raiz. Leia antes de mexer em coletores ou métricas: vários comportamentos de filtro parecem estranhos e são intencionais.

## Windows

- PowerShell 5.1: use `pnpm.cmd`, porque o shim `pnpm.ps1` é bloqueado pela Execution Policy.
- Nunca edite arquivo UTF-8 via PowerShell (`Set-Content`, redireção): sai mojibake.
- Nunca pipe CLI que muta arquivos por `2>&1 | Select-Object`: pode abortar o comando no meio.

## Validar a mudança na UI

1. `pnpm dev` e exercite o caminho em `http://localhost:5173`.
2. Confira o que de fato renderiza (textos do DOM, tabelas, valores) e o console do navegador.
3. Tabs do Reka UI não respondem a `.click()` sintético: use clique real ou navegue pela URL (`/devs`, `/health`).
4. Feche com os gates acima, incluindo `pnpm check:data` se você mexeu nos coletores.

## Harness de regressão das agregações (`snapshot:metrics`)

Não há suíte de testes; para mudanças no núcleo de filtros/agregações (`filters-core.ts`, `filters.ts`, `aggregations.ts`) o método de validação da casa é o `scripts/snapshot-metrics.ts`: um script node/tsx puro (sem vite, sem browser) que injeta o `public/data/stats.json` real no ref do store, muta os filtros só pelas ações nomeadas e imprime um snapshot JSON determinístico de tudo o que deriva deles, para uma matriz de cenários.

```bash
pnpm snapshot:metrics > baseline.json              # stdout = o JSON do baseline
pnpm snapshot:metrics --now=2026-10-01 > b.json    # relógio pinado (ver abaixo)
```

- **Cenários** — 6 bases × 3 escopos de trabalho (`all`/`prod`/`progress`) = 18 snapshots: `default-12m`, `range-all`, `custom-range` (janela derivada dos dados), `bots-on`, `single-repo` e `single-dev` (nomes de repo/dev lidos do `stats.json`, nada hardcoded). Cada snapshot traz `filteredTotals`, `filteredCommitCount`, `previousTotals`, as linhas de `pace`, `burnout` e `offHoursPeriod` e a contagem + somas aditivas das 4 projeções filtradas (`filteredWeekly`/`Monthly`/`Heatmap`/`Types`).
- **Determinismo**: a saída tem chaves ordenadas e nenhum timestamp — mesmo `stats.json` + mesmo relógio → mesmos bytes. Os presets de período e as janelas fixas de semanas derivam de "hoje": execuções seguidas são idênticas, mas para um baseline guardado entre dias use `--now=YYYY-MM-DD` (pina o `Date` global no meio-dia local). Compare baselines gerados na mesma máquina/fuso.
- **Comparar versões**: gere o baseline no `main`, mude para o branch, gere de novo com o MESMO `stats.json` e compare byte a byte (`cmp` / `sha256sum`). Todo número que se move é uma mudança de comportamento que o diff precisa explicar.
- **Sanity embutido**: o script verifica a identidade aditiva `prod + progress == all` em todos os cenários (no stderr) e sai com 1 se houver qualquer violação.
- **Privacidade**: sobre dados reais a saída contém nomes reais de autores e repos — nunca commite um baseline gerado sobre os dados do time. Para um baseline compartilhável, gere o fixture sintético (`pnpm exec tsx scripts/make-demo-data.ts`) e rode sobre ele.

Depois da revisão, o caminho até a versão está em [Ritual de release](./release.md); o destino do `dist/` está em [Publicando o build estático](../guide/publishing.md).
