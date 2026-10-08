# gitview

Dashboard interno de métricas do time example: commits, PRs e releases dos repositórios da org, tudo local e read-only sobre os repos.

## Setup

Requisitos:

- **Node 24+** (a coleta usa `node:sqlite`)
- **pnpm 10+**
- Uma conta GitHub — autenticada pela própria UI (device flow) ou via **GitHub CLI** (`gh auth login`)

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev       # http://localhost:5173 — na primeira execução cai no assistente /setup
```

### Setup pela UI (`/setup`)

Na primeira execução (sem dados coletados) o dashboard redireciona para o assistente de 3 passos — também acessível depois pelo botão ⚙ no navbar:

1. **Conectar o GitHub** — se `oauthClientId` estiver configurado, autentica via **device flow** (o browser abre `github.com/login/device`, você digita o código e pronto; o token fica só no seu `config.local.json`). Sem OAuth App, cai na ponte do `gh auth token`.
2. **Escolher repositórios** — lista os repos da sua org (ou da sua conta pessoal), com busca e pré-seleção do `defaultRepos`.
3. **Clonar e coletar** — faz clones bare em `data/repos/` e já roda a primeira coleta com progresso ao vivo.

Os clones de `data/repos/` são atualizados automaticamente via `git fetch` a cada coleta. Não é necessário ter os repos clonados em lugar nenhum.

### Setup pelo terminal (alternativa)

`pnpm setup` faz o mesmo fluxo no terminal (usa o `gh` para listar/clonar). Útil para automação ou se preferir não abrir a UI antes.

### Apontar para clones existentes

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

### Usando com outro time/org

O `config.json` versionado é um preset do time example — **nada nele é específico de máquina** (caminhos de repo só em `config.local.json`/env, nunca no git). Para usar com outro time:

- `githubOrg` — sua org no GitHub (se vazio, o setup pergunta)
- `defaultRepos` — pré-seleção do setup (se vazio, o padrão é "todos não arquivados")
- `oauthClientId` — Client ID de um **OAuth App** seu/da sua org com **Device Flow habilitado** (GitHub → Settings → Developer settings → OAuth Apps). Com ele, o setup autentica pela UI sem precisar do `gh`. Sem ele, tudo funciona via `gh auth login`. Nunca coloque o client secret no repo — o device flow não usa secret.
- `authors` / `githubUsers` / `githubBots` / `bots` — mapeamentos de identidade do time. **Opcionais**: sem eles o dashboard funciona normalmente, só não agrupa aliases (cada e-mail/login vira um autor separado) e a coleta lista os logins sem mapeamento pra você ir completando.

## Comandos

```bash
pnpm setup              # wizard: escolher/clonar repos da org
pnpm collect            # os 3 coletores em sequência (incremental)
pnpm collect:github     # só PRs/reviews
pnpm collect:releases   # só releases
pnpm dev                # dashboard (navbar: ↻ roda a coleta, ⚙ abre o assistente /setup)
pnpm build              # build estático
pnpm changeset          # registrar mudança
pnpm version:packages   # aplicar changesets (bump + CHANGELOG)
```

## Convenções

- Toda mudança = changeset (`minor` feature / `patch` fix) → `pnpm version:packages` → commit único com `chore(release): X.Y.Z` no corpo.
- Commits em pt-BR (Conventional Commits), código em inglês, comentários em pt-BR.
- `data/` (banco + clones) e `public/data/` são gerados e gitignored.
- Detalhes de arquitetura e regras de filtro: ver `AGENTS.md`.
