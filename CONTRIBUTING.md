# Contribuindo com o gitview

O gitview é **read-only** sobre os dados: nem os coletores nem a UI escrevem nos repositórios analisados — eles leem `git log`/tags e a API do GitHub e geram JSON em `public/data/` (local e gitignored). PRs que proponham escrever em repos fora dessa linha não serão aceitos.

## Ambiente de dev

```bash
pnpm install
pnpm dev        # http://localhost:5173 — na primeira execução cai no assistente /setup
```

Requisitos: **Node 24+** (o `node:sqlite` é nativo) e **pnpm 10+**. O `.env` é criado sozinho a partir do `.env.example` na primeira execução; o cadastro do time vive no `team.local.json` (gitignored). Para usar sem a org real, dá para apontar `GITVIEW_REPOS_ROOT` para clones seus (seção "Apontar para clones existentes" do README) — token com acesso a uma org pública pequena basta.

## Gates antes de abrir PR

Não há suíte de testes; estes são os checks:

```bash
pnpm typecheck   # tsc --noEmit (scripts + src; templates .vue ficam fora)
pnpm build       # vite build — o check de compilação
pnpm check:data  # valida shape + invariantes dos JSONs coletados (roda no fim do pnpm collect)
```

## Estilo

- Código em inglês; comentários e mensagens de commit em **pt-BR**, no formato Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, `chore(release): ...`).
- Formatação segue o estilo `@antfu/eslint-config` — **sem ponto-e-vírgula**, **aspas simples**. Não há config de ESLint nem script `lint` no repo: espelhe os arquivos vizinhos (o `pnpm typecheck` pega o resto).
- Edite arquivos UTF-8 com editor de verdade — em Windows/PowerShell, nada de `Set-Content`/redireção (mojibake).

## Changesets — obrigatório em toda mudança

Toda mudança de código vem com um changeset:

```bash
pnpm changeset   # minor = feature · patch = fix
```

A release é aplicada por quem mantém: `pnpm version:packages` bumpa a versão, escreve o `CHANGELOG.md` e resulta num commit único `chore(release): X.Y.Z`. PR com mudança de código sem changeset pedido = revisão devolve.

## dev-only vs build estático (importante)

Os endpoints de escrita (`/__setup/*`, `/__collect`, `/__clean`, `/__team/config`, `/__team/github`) são **middleware do dev server** — não existem no `pnpm build`. Consequências:

- `/setup` (wizard), `/settings` e o botão de coleta (↻) só funcionam em `pnpm dev`.
- `/teams` e `/repos` renderizam sempre (os dados vêm dos JSONs), mas **editam** só no dev — no build estático são somente leitura.

Se sua feature depende de escrever config/dados pela UI, ela nasce atrás de `import.meta.env.DEV` e **precisa degradar bem no estático**: a página continua renderizando os dados, só sem os controles de edição. Feature nova que não respeita isso não entra.

## Arquitetura

O `AGENTS.md` na raiz documenta o pipeline (git → SQLite → `public/data/*.json`), o contrato de `route.meta`/guards e as regras dos filtros — leia antes de mexer em coletores ou métricas; vários comportamentos "estranhos" dos filtros são intencionais e estão rotulados na UI.
