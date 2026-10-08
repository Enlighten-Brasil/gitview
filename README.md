# gitview

Dashboard interno (Vue 3 + TS + Vite + ECharts + Nuxt UI v4) com estatísticas de commits, PRs e releases do time em vários repositórios git.

## Como funciona

```
git log (todos os repos)   →  data/gitview.db (SQLite, incremental)  →  public/data/stats.json + commits.json
gh api graphql             →  public/data/github.json   (PRs + reviews)
git tag + gh api REST      →  public/data/releases.json (tags + notas de release)
                                       ↓
                            frontend 100% estático (só lê os JSONs)
```

O SQLite usa o `node:sqlite` nativo do Node 24 (sem dependências nativas).
Os JSONs são gitignored — sempre regenerados pelos coletores.

## Uso

```bash
pnpm install
pnpm collect   # roda os 3 coletores: git → stats.json, GitHub → github.json, releases → releases.json
pnpm dev       # http://localhost:5173
```

Re-rodar `pnpm collect` é **incremental** (INSERT OR IGNORE por repo+hash): só commits novos entram.
`pnpm collect:github` e `pnpm collect:releases` rodam partes isoladas. A coleta do GitHub requer `gh` autenticado.

## Configuração (`config.json`)

- `reposRoot` — pasta que contém os repositórios git (auto-descoberta: toda subpasta com `.git`)
- `exclude` — nomes de repos a ignorar
- `authors` — aliases: `"Nome Canônico": ["email1", "email2"]` — consolida a mesma pessoa que commita
  com nomes/e-mails diferentes. Mudou o alias? Rode `pnpm collect` de novo: os commits já gravados são re-normalizados.
- `bots` — autores extras a tratar como bot (além do padrão `*[bot]`)
- `githubUsers` — login do GitHub → nome canônico do time (mapeamento explícito)
- `githubBots` — logins de bot (dependabot etc.)

## O que tem no dashboard

**Visão geral** — cards do período com delta (↑/↓ vs janela anterior), timeline de commits por semana/mês, heatmap dia × hora.

**Time** — campeão da semana 🏆, ritmo (4 semanas vs média das 8 anteriores), heatmap dev × mês, ranking completo
(ordenável, exportável em CSV). Clique no dev → página dedicada `/dev/:name` (cards, timeline, donut de repos,
horários, PRs abertos, últimos 50 commits com links pro GitHub).

**Saúde** — painel de risco do time:
- Fora do horário (8 semanas) + fora do horário no período filtrado
- Fix hotspots (% de commits fix por repo, com threshold)
- Gargalo de review (concentração de reviews em 1 pessoa por repo)
- PRs parados (abertos há 14+ dias)
- % mergeado sem review (com threshold)
- Tendência de cycle time por repo (6 meses; alerta "subindo" após 3 meses de alta)
- Inatividade (repos 30+d sem commit, devs 21+d sem commit)
- Bus factor × reviewers (concentração de commits cruzada com quem revisa — ponto cego quando o dev principal domina as reviews)

**Repos** — listagem clicável (commits, devs, % fix, última release, commits não liberados) + gráficos cross-repo
(share, repo × mês, tipos de commit). Clique no repo → página dedicada `/repo/:name` (cards, tipos, commits por dev,
timeline de releases com notas do GitHub).

**Pull requests** — cards (abertos, +7d, mergeados, cycle time mediano, % sem review), aging dos abertos,
cycle time por repo, reviews por dev.

## Filtros e URL

- **Período**: presets 1/3/6/12/24M/Tudo **ou** range personalizado de/até (corta por mês inteiro; sem delta nos cards).
- **Repos**, **devs** (com ações em massa) e **bots** (fora por padrão).
- Estado inteiro na query string — links compartilháveis: `?tab=health&range=6&repos=en-sdk&devs=Ana`
  ou `?from=2026-09-01&to=2026-09-30`. Aba também persiste em localStorage.
- Alguns painéis usam janela fixa intencional (ritmo, burnout, cycle trend, PRs abertos) — estão rotulados.

## Releases

`pnpm collect:releases` lê as tags git locais (universal) e casa com as releases do GitHub (notas, prerelease, URL).
Métricas: commits entre releases, **commits não liberados** (desde a última tag), dias desde a última release.

## Versionamento

Changesets: toda mudança gera um changeset (`pnpm changeset`), depois `pnpm version:packages` aplica o bump
+ CHANGELOG, e o commit de release fecha com `chore(release): X.Y.Z`. Histórico completo em `CHANGELOG.md`.
Para agentes: ver `AGENTS.md`.
