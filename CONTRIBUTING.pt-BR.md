# Contribuindo com o gitview

O gitview é **read-only** sobre os dados: nem os coletores nem a UI escrevem nos repositórios analisados — eles leem `git log`/tags e a API do GitHub e geram JSON em `public/data/` (local e gitignored). PRs que proponham escrever em repos fora dessa linha não serão aceitos.

## Ambiente de dev

```bash
pnpm install
pnpm dev        # http://localhost:5173 — na primeira execução cai no assistente /setup
```

Requisitos: **Node 22.13+** (os coletores usam `node:sqlite`, sem flag desde a 22.13; o CI roda Node 22) e **pnpm 11.28** (pinado no campo `packageManager` — rode `corepack enable` uma vez para o corepack assumir, ou instale o pnpm 11.28 direto). O `.env` é criado sozinho a partir do `.env.example` na primeira execução; o cadastro do time vive no `team.local.json` (gitignored). Para usar sem a org real, dá para apontar `GITVIEW_REPOS_ROOT` para clones seus (seção "Apontar para clones existentes" do README) — token com acesso a uma org pública pequena basta.

O repo pina a policy de supply chain do pnpm `minimumReleaseAge: 1440` no `pnpm-workspace.yaml`: só instala pacote publicado há pelo menos 24h. Um bump de dependência recente que esbarre no `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` é esperado — espere a versão amadurecer ou liste-a em `minimumReleaseAgeExclude`.

## Gates antes de abrir PR

Não há suíte de testes; estes são os checks:

```bash
pnpm lint       # eslint (@antfu/eslint-config) — zero erros é requisito
pnpm typecheck  # tsc --noEmit (scripts + src; templates .vue ficam fora)
pnpm build      # vite build — o check de compilação
pnpm check:data # valida shape + invariantes dos JSONs coletados (roda no fim do pnpm collect)
```

O CI (`.github/workflows/ci.yml`) roda `pnpm lint`, `pnpm typecheck` e `pnpm build` em todo PR e em push em `main`. O `check:data` fica fora do CI de propósito: ele valida `public/data/`, que só existe depois de uma coleta local.

## Estilo

- Código em inglês; comentários e mensagens de commit em **pt-BR**, no formato Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `chore(release): ...`).
  - Por que pt-BR: o time que constrói e mantém o gitview trabalha em pt-BR e o histórico de commits é o log de trabalho desse time; código e docs públicos ficam em inglês para a comunidade open-source usar o projeto.
- Formatação é verificada por `pnpm lint` — `eslint.config.js` aplica o `@antfu/eslint-config` (padrão do maintainer do gitview; **sem ponto-e-vírgula**, **aspas simples**) com as exceções de vue do mesmo padrão (`no-mutating-props` e `prefer-separate-static-class` off — os editors de draft mutam objetos do pai de propósito).
- Edite arquivos UTF-8 com editor de verdade — em Windows/PowerShell, nada de `Set-Content`/redireção (mojibake).

## Changesets — obrigatório em toda mudança

Toda mudança de código vem com um changeset:

```bash
pnpm changeset   # minor = feature · patch = fix
```

A release é aplicada por quem mantém: `pnpm version:packages` bumpa a versão, escreve o `CHANGELOG.md` e resulta num commit único `chore(release): X.Y.Z`. Commits de trabalho que fecham issues do roadmap terminam o corpo com `Ref: #N`. PR com mudança de código sem changeset pedido = revisão devolve.

## dev-only vs build estático (importante)

Os endpoints de escrita (`/__setup/*`, `/__auth/*`, `/__collect`, `/__clean`, `/__team/config`, `/__team/github`) são **middleware do dev server** — não existem no `pnpm build`. Consequências:

- `/setup` (wizard), `/settings` e o botão de coleta (↻) só funcionam em `pnpm dev`.
- `/teams` e `/repos` renderizam sempre (os dados vêm dos JSONs), mas **editam** só no dev — no build estático são somente leitura.

Se sua feature depende de escrever config/dados pela UI, ela nasce atrás de `import.meta.env.DEV` e **precisa degradar bem no estático**: a página continua renderizando os dados, só sem os controles de edição. Feature nova que não respeita isso não entra.

## Os pares de docs (README + CONTRIBUTING)

`README.md` (inglês) é o documento primário e `README.pt-BR.md` é o espelho seção a seção — este arquivo e o `CONTRIBUTING.pt-BR.md` seguem a mesma regra. Toda mudança de documentação atualiza os dois arquivos do par na mesma mudança, e todo comando ou label citado precisa existir no `package.json`/nos componentes.

## Documentação

O site em `docs/` é VitePress: 19 páginas em inglês com espelho pt-BR seção a seção (`docs/pt-BR/…`, mesmos nomes de arquivo). Mantê-lo saudável faz parte do trabalho:

- **Os dois idiomas, mesma mudança.** Toda edição em docs atualiza a página em inglês e o espelho em `docs/pt-BR/` no mesmo PR. Labels de nav e sidebar em `docs/.vitepress/config.ts` seguem os títulos das páginas (`text:` == `title` do frontmatter) — quando o título de uma página muda, os labels mudam junto, nos dois idiomas.
- **Regra anti-rot.** Se o seu PR muda um label de UI, um comando ou nome de script, uma chave de config (`GITVIEW_*`, campos do `team.local.json`) ou uma regra de métrica, toda página que cita isso é atualizada **no mesmo PR** — label que mudou no `src/` e não mudou na doc é bug. Revisor grepa os claims citados contra o código; o que não bater volta em review.
- **Docs não duplicam o README.** As páginas linkam para as seções do README e as aprofundam (contexto, exemplos, casos-limite) — nunca as reescrevem.

Comandos, na raiz do repo:

```bash
pnpm docs:dev       # vitepress dev servido da raiz (DOCS_BASE=/)
pnpm docs:build     # build estático em docs/.vitepress/dist
pnpm docs:preview   # serve o site gerado localmente
pnpm check:docs     # gate de paridade das docs (espelhos EN ↔ pt-BR)
```

Em Windows/PowerShell, rode como `pnpm.cmd docs:dev`, `pnpm.cmd docs:build`, `pnpm.cmd docs:preview` e `pnpm.cmd check:docs` (o PowerShell 5.1 não executa o `pnpm.ps1`).

## Reportar bugs

Abra uma issue no GitHub com o que você fez, o que esperava e o que aconteceu — a saída dos coletores e os avisos do `check:data` ajudam a amarrar bugs bem mais rápido. Lembre-se: a ferramenta é read-only sobre os repos analisados e nunca escreve neles.

## Arquitetura

O `AGENTS.md` na raiz documenta o pipeline (git → SQLite → `public/data/*.json`), o contrato de `route.meta`/guards e as regras dos filtros — leia antes de mexer em coletores ou métricas; vários comportamentos "estranhos" dos filtros são intencionais e estão rotulados na UI.
