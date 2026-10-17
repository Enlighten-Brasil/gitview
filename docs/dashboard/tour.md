---
title: Dashboard tour
description: Page-by-page tour of the gitview dashboard — what question each page answers, its panels, and where each link goes.
---

# Dashboard tour

gitview is a read-only dashboard over your own git data: the collector exports JSON to `public/data/`, and the frontend just reads it. This tour walks the pages in navigation order. For each one: the question it answers, the panels you see (their real on-screen labels), what is interactive, and where the links go. Filter rules have their own page: [Filter rules](./filters.md).

The rail (left icon bar) groups the pages: **Dashboards** (**Visão geral** `/`, **Devs** `/devs`, **Saúde** `/health`), **Times** `/teams`, **PRs** `/prs`, **Repos** `/repos`, and — only on the dev server — **Config** `/settings`. The navbar on top carries the data freshness badge, the weekly summary button, and (dev only) the collection controls.

## Visão geral (`/`) — what is the team shipping right now?

The landing page. Three panels, top to bottom:

- **SummaryCards** — the section label reads **no período ·** *\<window\>*. Cards: **commits**, **linhas +**, **linhas −**, **devs ativos**, **repos ativos**. Each card shows a delta against the previous equivalent window (tooltip **vs o mês anterior**, **vs os N meses anteriores** or **vs a janela anterior equivalente**). A dim line below repeats the lifetime totals: `histórico total: …`. The delta disappears in custom ranges and in **Tudo** — see [Filter rules](./filters.md).
- **AlertStrip** — only shows what is unhealthy (all clear, the strip is gone). Each chip is a deep link to the canonical home of the metric: PRs parados → `/prs#abertos`, merges sem review → `/prs#reviews`, ritmo → `/devs`, fora do horário e inatividade → `/health`, commits não liberados → `/repos#tabela`.
- **CommitsTimeline** — the chart title is **Commits por semana (por dev)** or **Commits por mês (por dev)**, with **semana** / **mês** toggle buttons.

Interactive: chart panels export a PNG (download icon in the panel header, toast **Imagem exportada**); every alert chip navigates; every chart tooltip shows the underlying numbers.

Links: alert chips (above); the rail; and everything the sidebar filters touch.

## Devs (`/devs`) — who is doing what?

The people page. Six panels:

- **PeriodHighlight** — the top committer of the filtered period (crown icon, badge **N% do período**).
- **WeeklyChampions** — **Campeão da semana — maior evolução**. Two tables: the recent weekly winners (columns semana / dev / vs média / commits) and the title count (**vitórias (período)**). The prize rewards *evolution* (commits ÷ (the previous 8 weeks' average + 1), floor of 3 commits in the week), not raw volume — see [issue #10](https://github.com/Enlighten-Brasil/gitview/issues/10).
- **PaceAlert** — **Ritmo — últimas 4 semanas vs 8 anteriores**. Who is falling behind their own baseline.
- **AuthorMonthHeatmap** — **Dev × mês (comparação)**.
- **ActivityHeatmap** — **Frequência — dia da semana × hora**.
- **DevTable** — **Ranking do time (histórico completo)**. Columns Dev, commits, + linhas, − linhas, repos, dias ativos, commits/dia ativo, streak, último commit — everything except Dev and commits/dia ativo sorts, there is a **CSV** export button, and the streak column shows as a badge.

Interactive: column sorting, **CSV** export (toast **CSV exportado**), chart PNG export, heatmap tooltips.

Links: each dev name links to the dev profile `/devs/:name`. The ranking is intentionally full-history regardless of the period filter.

:::info Why does the ranking ignore the period?
**Ranking do time (histórico completo)** is a standing table — who the team *is*, not who happened to ship in the last quarter. The period-scoped view of the same people lives in the cards and charts above it, and in the heatmaps. The panel title says it out loud so nobody "fixes" it.
:::

## Dev profile (`/devs/:name`) — what does this dev's work look like?

Answers "what has \<name\> been doing in the selected period". The old route `/dev/:name` still works as an alias. If the name doesn't match collected data, the page says **Dev não encontrado** and offers **Quis dizer:** suggestions.

- **DevStatCards** — **commits**, **linhas +**, **linhas −** (period) plus lifetime cards that gain a ` (total)` suffix when a period is active: **dias ativos (total)**, **commits/dia ativo (total)**, **streak (total)**, **repositórios (total)**. With GitHub data also: **PRs abertos**, **cycle time mediano**, **reviews feitas**.
- **CommitsTimeline** for this dev only (**Commits por semana** / **Commits por mês**).
- **Distribuição por repositório** (donut) and the hours heatmap — **Horários de atividade —** *\<window\>*, or **Horários de atividade — últimos 24 meses** under **Tudo** (the aggregation tops out at 24 months).
- **PRs abertos de** *\<first name\>* — the dev's currently open PRs (state *now*, not period-scoped).
- **Últimos commits** — the commit list for the period.

Interactive: timeline granularity toggle, chart PNG export.

Links: **dashboard** back button in the header (to `/`); PR rows link out to GitHub.

## Saúde (`/health`) — where does the process hurt?

The health page. Each card documents its own thresholds in the footer. Panels:

- **OffHoursPanel** — **Fora do horário**, with a mode toggle: **8 semanas** or the current window label. Weekend/late-night commits per dev, with status **pontual** / **atenção** / **padrão**.
- **FixHotspots** — **Fix hotspots — % de correção por repo**.
- **ReviewBottleneck** — **Gargalo de review — quem segura os PRs**.
- **ReviewCoverage** — **Merge sem review — período filtrado**.
- **InactiveWatch** — **Inatividade — repos e devs parados**, split in two lists: **repos sem commit há 30+ dias** and **devs sem commit há 21+ dias**. Measured until today — it deliberately ignores the filters.
- **BusFactor** — **Bus factor — concentração por repositório**.

Interactive: **Fora do horário** mode toggle; chart PNG export; the tables sort by risk columns where shown.

Links: alerts on the Visão geral deep-link here; nothing on this page links out.

## PRs (`/prs`) — what's stuck, and how fast do PRs move?

Needs `public/data/github.json` (collected with `gh` authenticated); otherwise the page shows **Sem dados do GitHub**. Three anchored sections feed the contextual sub-nav (**Abertos**, **Cycle time**, **Reviews**):

- `#abertos` — **PrSummaryCards**: **PRs abertos** (with a rascunhos sub-line), **parados há +14 dias**, **mergeados no período**, **cycle time mediano**, **mergeados sem review**. Then **PrStaleAlert** (**PRs parados — abertos há 14+ dias**) and **PrOpenTable** (**PRs abertos — mais antigos primeiro**).
- `#cycle-time` — **PrCycleTime** (**Cycle time mediano por repo (criação → merge)**) and **CycleTrend** (**Tendência de cycle time — últimos 6 meses** — a fixed window, on purpose).
- `#reviews` — **PrReviews** (**Reviews por dev (no período)**).

Interactive: chart PNG export; PR rows link to GitHub.

Links: rail sub-nav jumps to `#abertos`, `#cycle-time`, `#reviews`; the Visão geral alerts land on `#abertos` and `#reviews`.

## Repos (`/repos`) — which repos are active, and are they shipping?

The repo index. Anchors feed the sub-nav (**Tabela**, **Linhas +/−**, **Distribuição**, **Por mês**, **Tipos de commit**, **Releases**):

- `#tabela` — **Repositórios**: repo / commits / devs / % fix / último commit / última release / não liberados.
- `#linhas` — **Linhas adicionadas × removidas por mês** or **Crescimento líquido do código (acumulado)**, toggled by **por mês** / **acumulado**.
- `#distribuicao` — **Distribuição por repositório (período filtrado)**.
- `#por-mes` — **Repositório × mês**.
- `#tipos` — **Tipos de commit por mês (feat × fix × ...)** and **Mix por repo (% — ordenado por fix)**.
- `#releases` — **Releases por repositório**, with the footnote **marcos — ignoram o filtro de período · clique no repo pra ver a cadência completa**. Each repo shows last tag, age and cadence (**X/mês**, computed over a fixed trailing 12 months).

Interactive: chart PNG export; rows and repo names open the repo page.

Links: every row links to `/repos/:name`; the Visão geral unreleased-commits alert lands on `#tabela`.

## Repo (`/repos/:name`) — how is this one repo doing?

Alias `/repo/:name` still works. Unknown names get **Repo não encontrado**. The period filter applies here (commits, charts, merged PRs, cycle time); releases and open PRs are milestones/state and stay out of it.

- **StatCards** — **commits**, **linhas +**, **linhas −**, **devs** (period); with a period active also **commits (total)**. Release cards: **última release (há Nd)** and **commits não liberados** (color by threshold). Plus **dev principal** (top dev share, colored above 50%/70%), and with GitHub data **PRs abertos** and **cycle time mediano**.
- **Tipos de commit** (donut) and **Commits por dev** (top 10 bar chart).
- **Releases** — tag / data / commits / notas, with expandable **notas** and a **pré** badge for prereleases; shows the 30 most recent tags and says so.

Interactive: tag rows open the tag on GitHub when a URL exists; **notas** expands inline.

Links: **repos** back button (to `/repos`), a **GitHub ↗** link in the header when the release data has one.

:::info Why do releases ignore the period?
A release is a milestone — "when did this repo last ship" makes no sense cut to a quarter. The cards and the **Releases** table are deliberately period-blind, and the labels say so (`(total)`, **marcos — ignoram o filtro de período**). The commit counts *between* tags still follow the period where shown.
:::

## Times (`/teams`) — the team editor

Dev-server only: in a static build the editor is disabled and the page says **edição só no modo dev**. Sections `#times`, `#devs`, `#sem-mapeamento` feed the sub-nav.

- `#times` — one **TeamCard** per team: name, description, color picker, member chips. The section header carries **novo time**; **importar do GitHub** (slideover) lives at the top of the page. The save bar offers **desfazer**, **salvar**, **salvar + recoletar**.
- `#devs` — one **DevCard** per dev with their GitHub logins and commit e-mails; **editar perfil** opens a modal with **título / cargo**, **descrição**, **e-mails de commit**, **logins do GitHub**.
- `#sem-mapeamento` — **TeamCandidatesSection**: identities collected but not mapped to a dev, with **associar** / **confirmar** actions. The **CandidatesBanner** on `full`-scope pages deep-links here.

Interactive: rename, recolor, add/remove members, import from GitHub, save + re-collect (dev only).

Links: each **TeamCard** has a button that opens the team dashboard `/teams/:name`.

## Team dashboard (`/teams/:name`) — how is this one team doing?

Same panels as the main dashboard, but the dev filter is **locked to the team members** (source of truth: `team.json`). The header shows the team chip, the window label, a **times** back button and a **ver como filtro livre** button — that one opens `/?devs=<members>` as an editable filter.

Panels: **SummaryCards**, **CommitsTimeline**, **AuthorMonthHeatmap**, **CommitTypes**, then — with GitHub data — **PrSummaryCards**, **PrOpenTable**, **PrCycleTime**, and finally **OffHoursPanel**. Member chips link to each dev's profile.

Interactive: same as the panels they reuse; member chips navigate.

Links: member chips → `/devs/:name`; **ver como filtro livre** → `/` with `?devs=…`; renamed teams redirect automatically (old URLs stay alive via `teams[].renamedFrom`). Unknown names get **Time não encontrado** with **Times disponíveis:** suggestions.

## Weekly summary — the meeting-ready export

Not a route — a button in the navbar (tooltip **resumo da semana exportável**). It opens a slideover titled **Resumo da semana** with the markdown of the **last closed ISO week** (Mon–Sun) compared to the previous one: `## Commits`, `## Pull requests`, `## Releases`, `## Atenção`. Export with **copiar markdown** (button flips to **copiado!**) or **baixar .md** (saves `resumo-<weekKey>.md`). The report covers the *whole team* for the weekly meeting — which is why it always skips bots and never reads the sidebar filters; filtered "what if" views belong to the dashboards.

## The static build is read-only

The frontend only reads the JSON files in `public/data/` — `pnpm build` produces a 100% static `dist/` you can serve from any static host (GitHub Pages, Netlify, nginx…). It needs **SPA fallback**: deep links like `/devs/<name>` must serve `index.html` (the router uses `createWebHistory`).

In that build the dashboard is strictly read-only: `/setup`, `/settings` and the collection buttons (↻, **coleta completa (--full)**) don't exist, and the `/teams` editor is disabled — the `/__*` endpoints are dev-server middleware. Unify identities and tune teams under `pnpm dev`, re-collect with `pnpm collect`, then publish.

## Next steps

- [Filter rules](./filters.md) — how the period, teams and URL filters actually behave (including the fixed windows).
- `README.md` — install, collect, publish (the "Publishing the dashboard (static build)" section).
