# gitview

Dashboard leve (Vue 3 + TS + ECharts) com estatísticas de commits do time em vários repositórios git.

## Como funciona

```
git log (todos os repos)  →  data/gitview.db (SQLite, incremental)  →  public/data/stats.json  →  frontend
```

O frontend só lê o `stats.json` pronto — nada é recalculado no navegador.
O SQLite usa o `node:sqlite` nativo do Node 24 (sem dependências nativas).

## Uso

```bash
pnpm install
pnpm collect   # lê os repos e gera data/gitview.db + public/data/stats.json
pnpm dev       # http://localhost:5173
```

Re-rodar `pnpm collect` é **incremental** (INSERT OR IGNORE por repo+hash): só commits novos entram.

## Configuração (`config.json`)

- `reposRoot` — pasta que contém os repositórios git (auto-descoberta: toda subpasta com `.git`)
- `exclude` — nomes de repos a ignorar
- `authors` — aliases: `"Nome Canônico": ["email1", "email2"]` — consolida a mesma pessoa
  que commita com nomes/e-mails diferentes. Mudou o alias? Rode `pnpm collect` de novo:
  os commits já gravados são re-normalizados.

## O que tem no dashboard

- Cards: commits no período, histórico, devs, repos, linhas +/−
- Commits por semana/mês empilhados por dev (com zoom)
- Heatmap repositório × mês
- Heatmap dev × mês (comparação mês a mês entre pessoas)
- Heatmap dia da semana × hora (frequência/horário de trabalho)
- Donut de distribuição por repositório
- Campeão da semana 🏆 + ranking de títulos no período
- Ritmo da equipe: últimas 4 semanas vs média das 8 anteriores (📉 queda / 🚀 acelerando)
- Ranking do time: commits, linhas, repos tocados, dias ativos, commits/dia ativo, streak 🔥, último commit (ordenável, exportável em CSV)
- Visão individual por dev: clique na linha do ranking para drilldown (timeline, repos, heatmap pessoal)
- Filtros globais: período (3M/6M/12M/tudo), repositórios, devs
- Bots (`*[bot]`, ex.: dependabot) ficam fora por padrão — toggle "incluir bots" na barra de filtros.
  Autores extras podem ser marcados como bot via `"bots": ["nome"]` no `config.json`.
