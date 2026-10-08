# gitview

Dashboard interno de métricas do time example: commits, PRs e releases dos repositórios da org, tudo local e read-only sobre os repos.

## Setup

Requisitos:

- **Node 24+** (a coleta usa `node:sqlite`)
- **pnpm 10+**
- **GitHub CLI** com login: `gh auth login`

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm setup     # escolhe os repos da org e clona em data/repos (não precisa ter nada clonado antes)
pnpm dev       # http://localhost:5173
```

O `pnpm setup` lista os repositórios da org (`githubOrg` no `config.json`) usando o seu `gh`, deixa você escolher quais entram no dashboard e faz clones bare em `data/repos/` — atualizados automaticamente via `git fetch` a cada coleta. Não é necessário ter os repos clonados em lugar nenhum.

### Alternativas ao setup assistido

Se você já tem os repos clonados e prefere usá-los, o coletor procura a pasta na seguinte ordem:

1. Variável de ambiente `GITVIEW_REPOS_ROOT`
2. `reposRoot` em `config.local.json` (não versionado)
3. Auto-detect: pasta `../example` ao lado do clone do gitview
4. `reposRoot` do `config.json` versionado

Exemplo de `config.local.json`:

```json
{
  "reposRoot": "C:/Users/seu.usuario/Documents/GitHub/example"
}
```

A pasta apontada deve conter os diretórios git dos repos (`example-api`, `example`, …). Nesse modo os dados refletem o estado do seu clone local — dê `git pull` nos repos antes de coletar se quiser dados frescos.

## Comandos

```bash
pnpm setup              # wizard: escolher/clonar repos da org
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
- `data/` (banco + clones) e `public/data/` são gerados e gitignored.
- Detalhes de arquitetura e regras de filtro: ver `AGENTS.md`.
