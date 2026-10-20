# gitview

[![CI](https://github.com/Enlighten-Brasil/gitview/actions/workflows/ci.yml/badge.svg)](https://github.com/Enlighten-Brasil/gitview/actions/workflows/ci.yml)

**English:** [README.md](README.md)

**Métricas de git simples para qualquer time.** Commits, PRs e releases da sua org do GitHub, coletados na sua máquina. O gitview lê `git log`, as tags e a API do GitHub, gera JSON e serve um dashboard que nunca escreve nos repositórios analisados. Licença MIT.

**Demo ao vivo** (só dados sintéticos, nenhum dado real de time): https://enlighten-brasil.github.io/gitview/

**Documentação:** https://enlighten-brasil.github.io/gitview/docs/pt-BR/

![A página Visão geral do gitview: cards de resumo, a faixa de alertas e o gráfico de commits por semana (dados sintéticos da demo)](docs/public/screenshots/overview.png)

## Rodar agora

Requisitos: **Node 22.13+**, **pnpm 11.28** (pinado no campo `packageManager`; `corepack enable` uma vez resolve) e uma conta GitHub.

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev        # http://localhost:5173
```

Nada para copiar ou editar antes: o `.env` é criado a partir do `.env.example` na primeira execução. Sem dados coletados, o app abre o assistente `/setup` em quatro passos: conectar ao GitHub (device flow, PAT colado ou `gh auth login`), escolher os repositórios, clonar e coletar, e opcionalmente mapear as identidades do time.

## O que o dashboard mostra

- **Visão geral** (`/`): commits, linhas e ritmo do período, com faixa de alertas que leva direto ao problema.
- **Devs** (`/devs`, `/devs/<nome>`): ranking com commits, linhas, dias ativos e streak, heatmap de dia e hora, campeão semanal por evolução, CSV exportável.
- **PRs** (`/prs`): envelhecimento dos abertos, cycle time, reviews por dev, merge sem review.
- **Branches** (`/branches`): inventário de branches — alertas de pousadas e abandonadas, desvio develop × produção por repo e tabela ordenável com o join branch↔PR.
- **Repos** (`/repos`, `/repos/<nome>`): atividade por repositório, releases com as notas do GitHub e o grafo de commits da janela recente (`#grafo`).
- **Times** (`/teams`, `/teams/<nome>`): agrupe devs por time e abra o dashboard do time, com período e repos filtráveis.
- **Saúde** (`/health`): trabalho fora do horário, fix hotspots, gargalo de review, inatividade e bus factor.
- **Resumo semanal**: markdown da última semana ISO fechada contra a anterior, pronto para colar na reunião.

## Coletar e publicar

- `pnpm collect` roda os coletores e a validação dos dados; a coleta é incremental.
- `pnpm build` gera um `dist/` 100% estático que qualquer host serve, desde que com fallback de SPA para os deep links.
- No build estático o dashboard é somente leitura: setup, coleta e edição de times só existem em `pnpm dev`. Ajuste os times no dev, recolete e publique.

Fluxo completo de publicação, inclusive o deploy da demo: [Publicando o build estático](docs/pt-BR/guide/publishing.md).

## Comandos

```bash
pnpm dev / start        # dashboard em http://localhost:5173
pnpm setup              # assistente no terminal: escolher e clonar os repos da org
pnpm collect            # os 6 coletores em sequência + validação (incremental)
pnpm collect:branches   # só o inventário de branches
pnpm collect:github     # só PRs e reviews
pnpm collect:graph      # só a topologia do grafo de commits
pnpm collect:releases   # só releases
pnpm collect:team       # só o cadastro do time
pnpm check:data         # valida shape e invariantes dos JSONs coletados
pnpm check:scrub        # gate de identidade dos arquivos tracked (também no CI)
pnpm lint / lint:fix    # ESLint @antfu/eslint-config
pnpm typecheck          # tsc --noEmit (scripts + src)
pnpm build              # build estático em dist/
pnpm preview            # serve o dist/ local
pnpm clean              # apaga banco + JSONs; -- --repos apaga também os clones
pnpm docs:dev           # site de docs em docs/ (VitePress)
pnpm changeset          # registrar mudança
pnpm version:packages   # aplicar changesets (bump + CHANGELOG)
```

## Dados na sua máquina

O `.env` guarda a config da máquina (token, org, pasta dos clones) e o `team.local.json` guarda o cadastro do time (perfis, aliases, times). Os dois são gitignored e criados por você; o `GITVIEW_GITHUB_TOKEN` é o único segredo do projeto. Banco, clones e JSONs são regeneráveis a partir dos repositórios.

Referência completa: [O arquivo .env](docs/pt-BR/configuration/env.md) e [Config do time](docs/pt-BR/configuration/team.md).

Para um token fisicamente incapaz de escrever, use um **GitHub App** com *Repository Contents: Read-only* e coloque o Client ID dele no `.env`. O device flow não usa client secret.

## Contribuir

Branch a partir da `main`, gates antes do PR (`pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build`), changeset em toda mudança e commit em pt-BR no formato Conventional. O fluxo está em [CONTRIBUTING.pt-BR.md](CONTRIBUTING.pt-BR.md) e detalhado em [Ambiente de desenvolvimento](docs/pt-BR/contributing/development.md) e [Ritual de release](docs/pt-BR/contributing/release.md). O roadmap vive nas issues e milestones do GitHub.

Licença: MIT.
