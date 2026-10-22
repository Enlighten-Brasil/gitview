# Contribuindo com o gitview

O gitview é read-only sobre os dados: coletores e UI leem `git log`, tags e a API do GitHub, e escrevem só em `public/data/` (local, gitignored). PR que proponha escrever nos repos analisados não será aceito.

## Mão na obra

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev        # http://localhost:5173; sem dados, cai no assistente /setup
```

Requisitos: **Node 22.13+** (`node:sqlite` sem flag desde a 22.13) e **pnpm 11.28** (pinado no campo `packageManager`; `corepack enable` uma vez resolve). O `.env` nasce do `.env.example` na primeira execução e o cadastro do time vive no `team.local.json`, ambos gitignored. Abra uma branch a partir da `main` e mande o PR contra a `main`.

## Gates antes do PR

A suíte de testes é o Vitest (ambiente node, testes em `test/`):

```bash
pnpm check:scrub  # arquivos tracked livres dos termos de identidade removidos
pnpm lint         # ESLint @antfu/eslint-config; zero erros é requisito
pnpm typecheck    # tsc --noEmit em scripts/, src/ e test/ (templates .vue fora)
pnpm test         # vitest run; a suíte tem que estar verde
pnpm build        # vite build; o check de compilação
pnpm check:docs   # paridade EN e pt-BR das páginas de docs/
pnpm check:data   # shape e invariantes dos JSONs coletados (roda na máquina)
```

O CI roda `check:scrub`, `lint`, `typecheck` e `build` no job `gates`, `test` no job `test`, e `check:docs` mais `docs:build` no job `docs`. O `check:data` fica na sua máquina porque `public/data/` é gitignored e só existe depois de uma coleta com token.

## Testes

- Lógica nova não-trivial nasce com teste em `test/<module>.test.ts`; `pnpm test` é gate e tem que estar verde no PR.
- Teste é node puro: sem `public/data/`, sem `.env`, sem rede — só fixtures inline, para a suíte rodar no CI e num clone limpo. Validação que precisa dos dados coletados continua no `scripts/snapshot-metrics.ts`.
- `pnpm test:watch` é o loop local. O `pnpm test:coverage` roda a suíte com coverage (provider v8) e trava o floor por escopo da #251: 90% de statements nos módulos de `src/` testados em #249 e 60% nas libs de `scripts/lib/` testadas em #250. É o que o CI roda no job `test`.

## Changeset e commit

- Toda mudança de código vem com changeset: `pnpm changeset` (`minor` = feature, `patch` = fix).
- Commits em pt-BR, Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`); código em inglês; comentários em pt-BR.
- Quem mantém fecha a release com `pnpm version:packages` e um commit único `chore(release): X.Y.Z`.
- Formatação é o que o lint manda: sem ponto-e-vírgula, aspas simples. `pnpm lint:fix` resolve o resto.

## Docs

O site em `docs/` é VitePress, com espelho pt-BR seção a seção em `docs/pt-BR/`. Os dois idiomas mudam no mesmo PR e o `pnpm check:docs` cobra o par. Se o PR muda um label de UI, um comando, uma chave `GITVIEW_*` ou uma regra de métrica, toda página que cita isso muda junto. As capturas em `docs/public/screenshots/` vêm do fixture sintético da demo: regenere com `pnpm.cmd demo:shots`.

```bash
pnpm docs:dev       # site em dev, servido da raiz (DOCS_BASE=/)
pnpm docs:build     # build estático em docs/.vitepress/dist
pnpm docs:preview   # serve o site gerado localmente
```

Em PowerShell 5.1 rode tudo como `pnpm.cmd <script>`: o shim `pnpm.ps1` é bloqueado pela Execution Policy.

## Onde está o detalhe

- [Ambiente de desenvolvimento](docs/pt-BR/contributing/development.md): todos os comandos, os gates, as convenções de código e o mapa do `src/`.
- [Ritual de release](docs/pt-BR/contributing/release.md): do changeset ao `chore(release)`, o que o CI exige e como propor mudança.
- [Publicando o build estático](docs/pt-BR/guide/publishing.md): o que o `pnpm build` gera e o que fica de fora dele.
- `AGENTS.md` na raiz: pipeline, contrato de `route.meta` e regras dos filtros. Vários comportamentos "estranhos" dos filtros são intencionais e rotulados na UI.

Escrever config ou dados pela UI só existe no dev server: os endpoints `/__*` são middleware e não entram no build. Feature nova que depende disso nasce atrás de `import.meta.env.DEV` e degrada para somente leitura no estático.

## Reportar bug

Abra uma [issue](https://github.com/Enlighten-Brasil/gitview/issues) com o que você fez, o que esperava e o que aconteceu. A saída dos coletores e os avisos do `pnpm check:data` amarram o bug mais rápido.
