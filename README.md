# gitview

Dashboard interno de métricas do time example: commits, PRs e releases dos 12 repositórios, tudo local e read-only sobre os repos.

## Setup

Requisitos:

- **Node 24+** (a coleta usa `node:sqlite`)
- **pnpm 10+**
- **GitHub CLI** com login: `gh auth login` (necessário para PRs e notas de release)

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm collect   # 1ª coleta é completa, leva alguns minutos (depois ~15s)
pnpm dev       # http://localhost:5173
```

### Onde estão os repositórios?

O coletor procura a pasta com os repos na seguinte ordem:

1. Variável de ambiente `GITVIEW_REPOS_ROOT`
2. `reposRoot` em `config.local.json` (não versionado)
3. Auto-detect: pasta `../example` ao lado do clone do gitview
4. `reposRoot` do `config.json` versionado

Se nenhuma existir, o coletor mostra instruções. Exemplo de `config.local.json`:

```json
{
  "reposRoot": "C:/Users/seu.usuario/Documents/GitHub/example"
}
```

A pasta apontada deve conter os diretórios git dos repos (`example-api`, `example`, …). O acesso é o seu próprio: os commits são lidos via `git log` local e os PRs via `gh` autenticado na sua conta.

## Comandos

```bash
pnpm collect            # os 3 coletores em sequência (incremental)
pnpm collect:github     # só PRs/reviews
pnpm collect:releases   # só releases
pnpm dev                # dashboard (botão ↻ no navbar roda a coleta pela UI)
pnpm build              # build estático
pnpm changeset          # registrar mudança
pnpm version:packages   # aplicar changesets (bump + CHANGELOG)
```

## Convenções

- Toda mudança = changeset (`minor` feature / `patch` fix) → `pnpm version:packages` → commit único com `chore(release): X.Y.Z` no corpo.
- Commits em pt-BR (Conventional Commits), código em inglês, comentários em pt-BR.
- `data/` e `public/data/` são gerados e gitignored.
- Detalhes de arquitetura e regras de filtro: ver `AGENTS.md`.
