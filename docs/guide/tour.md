---
title: Dashboard tour
description: "Each gitview dashboard page: the question it answers, the panels on screen and where the links go."
---

# Dashboard tour

Pages follow navigation order. For each one: the question it answers, the panels with their real on-screen labels and the link exits. Filter behavior lives in [Filter rules](../dashboard/filters.md); the data pipeline in [Pipeline](../architecture/pipeline.md). The screenshots use the public demo's synthetic data, never real team data.

The left rail groups **Dashboards** (**Visão geral** `/`, **Devs** `/devs`, **Saúde** `/health`), **Times** `/teams`, **PRs** `/prs`, **Branches** `/branches`, **Repos** `/repos`, **Relatórios** `/reports` and, dev server only, **Config** `/settings`. The navbar carries the data freshness badge, the weekly summary button and, in dev, the collection controls. Every chart panel exports a PNG through the download icon (toast **Imagem exportada**) and the tooltips show the numbers behind each point.

## Visão geral (`/`): what is the team shipping right now?

- Summary cards, under the label **no período ·** ("in the period ·") *\<window\>*: **commits**, **linhas +** ("lines +"), **linhas −** ("lines −"), **devs ativos** ("active devs"), **repos ativos** ("active repos"), each with the delta against the equivalent previous window. The dim line **histórico total: …** ("full history: …") repeats the totals.
- Alert strip: only what is unhealthy, and it disappears when everything is fine. Each chip goes to the metric's canonical home: PRs parados → `/prs#abertos`, merges sem review → `/prs#reviews`, ritmo → `/devs`, fora do horário and inatividade → `/health`, commits não liberados → `/repos#tabela`.
- **Commits por semana (por dev)** or **Commits por mês (por dev)**, toggled by the **semana** and **mês** buttons.

![Visão geral: summary cards, alert strip and commits per week (demo)](/screenshots/overview.png)

## Devs (`/devs`): who is doing what?

- Period highlight: the top committer, with a crown and the badge **N% do período** ("N% of the period").
- **Campeão da semana — maior evolução**: the weekly winners (semana / dev / vs média / commits) and the **vitórias (período)** count. The prize measures evolution against each dev's own baseline, not volume; the formula is in [Metrics glossary](../dashboard/metrics.md).
- **Ritmo — últimas 4 semanas vs 8 anteriores** ("Pace — last 4 weeks vs previous 8"): who is below their own average.
- **Dev × mês (comparação)**.
- **Frequência — dia da semana × hora**.
- **Ranking do time (histórico completo)** ("Team ranking (full history)"): Dev, commits, + linhas, − linhas, repos, dias ativos, commits/dia ativo, streak, último commit. Every column sorts except Dev and commits/dia ativo, with a **CSV** export (toast **CSV exportado** ("CSV exported")) and the record as a `máx` badge in the streak column. Full history on purpose; the period-scoped view is in the cards and heatmaps above.

Each dev name opens the profile `/devs/:name`.

## Dev profile (`/devs/:name`): what does this dev's work look like?

Answers what the person did in the selected period. `/dev/:name` stays as an alias; a name with no match in the data shows **Dev não encontrado** with **Quis dizer:** (did you mean) suggestions.

- Cards for **commits**, **linhas +** ("lines +"), **linhas −** ("lines −") in the period, plus the historical cards **dias ativos** ("active days"), **commits/dia ativo** ("commits/active day"), **streak** and **repositórios**: with a period active they carry the **(total)** suffix, and under a work-scope cut they read the selected scope (prod/progress) when the data carries `byScope`, degrading to the historical total with **(total)** on older data; with GitHub data, also **PRs abertos** ("open PRs"), **cycle time mediano (PRs do mês)**, **reviews feitas**.
- **Commits por semana** / **Commits por mês** for this dev only.
- **Distribuição por repositório** (donut) and **Horários de atividade —** *\<window\>*, which under **Tudo** becomes **Horários de atividade — últimos 24 meses** (the aggregation limit).
- **PRs abertos de** ("Open PRs of") *\<first name\>*: current state, not scoped to the period.
- **Últimos commits** ("Latest commits"): the commits of the period.

The **dashboard** button goes back to `/`; PR rows open GitHub.

![Dev profile: metric cards, commits per week and repo distribution (demo)](/screenshots/dev.png)

## Saúde (`/health`): where does the process hurt?

Each card documents its own thresholds in the footer; the values are in [Metrics glossary](../dashboard/metrics.md).

- **Fora do horário** (off-hours): toggles between **8 semanas** and the current window label. Weekend and late-night commits per dev, with status **pontual**, **atenção**, **padrão** (on time, attention, standard).
- **Fix hotspots — % de correção por repo**.
- **Gargalo de review — quem segura os PRs** (review bottleneck: who is holding the PRs).
- **Merge sem review — período filtrado** ("Merge without review — filtered period").
- **Inatividade — repos e devs parados** ("Inactivity — stalled repos and devs"): **repos sem commit há 30+ dias** ("repos with no commit for 30+ days") and **devs sem commit há 21+ dias** ("devs with no commit for 21+ days"). Measured up to today, ignores the filters.
- **Bus factor — concentração por repositório**.

The tables sort where a risk column exists; the Visão geral alerts point here and nothing on this page links out.

![Saúde page: off-hours, fix hotspots, review bottleneck and merge without review (demo)](/screenshots/health.png)

## PRs (`/prs`): what is stuck and how fast do PRs move?

Depends on GitHub data, collected with an authenticated `gh`; without it the page shows **Sem dados do GitHub**. The contextual sub-nav covers three anchors, and the Visão geral alerts land on `#abertos` and `#reviews`.

- `#abertos`: cards **PRs abertos** ("open PRs") (with a drafts sub-line), **PRs parados há 14+ dias** ("PRs stale for 14+ days"), **mergeados no período** ("merged in the period"), **cycle time mediano (corte por dia)** ("median cycle time (day cutoff)"), **mergeados sem review** ("merged without review"); then **PRs parados — abertos há 14+ dias** ("Stale PRs — open for {n}+ days") and **PRs abertos — mais antigos primeiro** ("Open PRs — oldest first").
- `#cycle-time`: **Cycle time mediano por repo (criação → merge, corte por dia)** and **Tendência de cycle time — últimos 6 meses**, a fixed window.
- `#reviews`: **Reviews por dev (no período)** ("Reviews per dev (in the period)").

PR rows open GitHub.

![PRs page: summary cards, stale and open PR tables, cycle time per repository (demo)](/screenshots/prs.png)

## Branches (`/branches`): what can be cleaned up and what has not shipped?

The branch inventory of the full collect (`branches.json`); the page ignores the period filter (the inventory is "now") and the scope chips — it *is* the progress view. The contextual sub-nav covers the anchors **Pousadas**, **Abandonadas**, **develop × produção** and **Tabela**. **Sem dados de branches** points at the full collect (the light one does not refresh the inventory); without GitHub data the page shows **Sem dados do GitHub** and the branch↔PR link degrades to **sem vínculo**.

- Freshness line: the **inventário** *\<age\>* badge, the **N branches em M repos** count and, when PRs lack `headRef`, the **vínculo PR↔branch: cobertura parcial (N%)** badge.
- `#pousadas` **Pousadas — podem ser limpas**: already merged (`aheadProd` 0 and `aheadInt` null or 0) or landed via squash and idle for 30+ days — cleanable. First five listed (with the **squash** badge where it applies) and **ver todas na tabela**.
- `#abandonadas` **Abandonadas — trabalho não liberado parado**: ahead > 0 with no open PR, idle for 30+ days — the work never reached production.
- `#develop-producao` **develop × produção**: integration ref vs production per repo — **+N** ahead (unreleased work), **−N** behind (with ahead 0, an abandoned integration).
- `#tabela` **Branches**, sortable by branch / repo / status / **à frente** / **atrás** / **vs integração** / **última atividade** / **autores à frente** / **PR**: status badges **produção**, **integração**, **feature**, **bot**, **pousada** plus the derived **pousada via squash** and **viva sem PR**; the PR cell links the PR (**aberto**/**mergeado**) or shows **sem vínculo** — which is not "no PR", since old GitHub cache may lack `headRef`.

![Branches page: the pousadas / abandonadas / develop × produção cards and the sortable table (demo)](/screenshots/branches.png)

## Repos (`/repos`): which repos are active and shipping?

Repository index, with an anchor sub-nav (**Tabela**, **Linhas +/−**, **Distribuição**, **Por mês**, **Tipos de commit**, **Releases**). The unreleased commits alert from Visão geral lands on `#tabela`.

- `#tabela` **Repositórios** ("Repositories"): repo / commits / devs / % fix / último commit / última release / não liberados. Each row opens `/repos/:name`.
- `#linhas` **Linhas adicionadas × removidas por mês** or **Crescimento líquido do código (acumulado)**, toggled by **por mês** and **acumulado**.
- `#distribuicao` **Distribuição por repositório (período filtrado)**.
- `#por-mes` **Repositório × mês**.
- `#tipos` **Tipos de commit por mês (feat × fix × ...)** and **Mix por repo (% — ordenado por fix)**.
- `#releases` **Releases por repositório** ("Releases per repository"): last tag, age and the **X/mês** ("X/mo") cadence over the last 12 months. Footer **marcos — seguem a seleção de repos da sidebar · ignoram o filtro de período e o escopo · clique no repo pra ver a cadência completa** (milestones follow the sidebar's repo selection and ignore the period filter; click a repo to see the full cadence).

## Repo (`/repos/:name`): how is this repository doing?

`/repo/:name` stays as an alias; an unknown name shows **Repo não encontrado**. The period applies to commits, charts, merged PRs and cycle time; releases and open PRs are milestones or current state, as [Filter rules](../dashboard/filters.md) describes.

- Cards for **commits**, **linhas +** ("lines +"), **linhas −** ("lines −"), **devs** in the period, **commits (total)** when a period or a scope cut is active, **última release (há Nd)**, **commits não liberados** (color by threshold), **dev principal** with the top share (colored above 50% and 70%) and, with GitHub data, **PRs abertos** ("open PRs") and **cycle time mediano (PRs do mês)**.
- **Tipos de commit** (donut) and **Commits por dev** (bars, top 10).
- **Releases**: tag / data / commits / notas, the **pré** badge for prereleases and inline-expandable **notas**; the 30 most recent tags, with a notice. The commit counts *between* tags follow the period where they appear.
- `#grafo` **Grafo de commits**: the repo's commit window drawn as a pure-SVG lane graph — one colored lane per branch, merge commits as hollow circles, ref chips that highlight the lane on hover (click to pin), rows linking to the commit on GitHub and a tooltip with the full subject, author, date and refs. The window is fixed (the last *N* commits, labeled in the footer) and ignores the period/bots/scope filters: parents outside the window end in dashed **continua** edges and **Mostrar mais antigos** grows the drawing 300 rows at a time. Full description in [Commit graph](../dashboard/graph.md).

Tag rows open GitHub when a URL exists; the **repos** button goes back to `/repos` and **GitHub ↗** opens the repository when the release data carries the URL.

![Repo page: the #grafo commit-graph section at the bottom of /repos/demo-api (demo)](/screenshots/graph.png)

## Times (`/teams`): the team editor

Dev server only; in the static build the page shows **edição só no modo dev** (editing only in dev mode). The sections feed the sub-nav and each team card has a button to the dashboard `/teams/:name`.

- `#times`: one card per team (name, description, color picker, member chips), **novo time** in the section header and **importar do GitHub** at the top of the page. The save bar carries **desfazer**, **salvar** and **salvar + recoletar** (undo, save, save + re-collect).
- `#devs`: one card per dev with GitHub logins and commit e-mails; **editar perfil** opens a modal with **título / cargo**, **descrição**, **e-mails de commit** and **logins do GitHub**.
- `#sem-mapeamento`: collected identities with no dev mapped yet, with **associar** and **confirmar**. The candidates banner on the dashboard pages points here.

## Team dashboard (`/teams/:name`): how is this team doing?

The same panels as Visão geral, with the dev selection locked to the team members (the team registry is the source of truth). The header carries the team chip, the window label, the **times** button and **ver como filtro livre** (view as a free filter), which opens `/?devs=<members>` as an editable filter.

Panels: summary cards, commits per week, **Dev × mês (comparação)** and commit types; with GitHub data, the PR cards, **PRs abertos — mais antigos primeiro** ("Open PRs — oldest first") and **Cycle time mediano por repo (criação → merge, corte por dia)**; and **Fora do horário**. Member chips open `/devs/:name`; a renamed team redirects from the old URL; an unknown name shows **Time não encontrado** with **Times disponíveis:**.

## Weekly summary: the meeting-ready export

A button in the navbar (tooltip **resumo da semana exportável** ("exportable week summary")), not a route. It opens the **Resumo da semana** ("Week summary") slideover with the markdown of the last closed ISO week (Mon–Sun) against the previous one: `## Commits`, `## Pull requests`, `## Releases`, `## Atenção`. Outputs: **copiar markdown** ("copy markdown") (the button becomes **copiado!** ("copied!")) and **baixar .md** ("download .md") (writes `resumo-<weekKey>.md`). The report is for the whole team in the weekly meeting, which is why it ignores the sidebar filters and always excludes bots.

## Static build

The interface only reads the collected data. In `pnpm build`, `/setup`, `/settings`, the collection buttons and the `/teams` editor do not exist. Adjust identities and teams under `pnpm dev`, re-collect with `pnpm collect`, and only then publish, per [Publishing the static build](./publishing.md).
