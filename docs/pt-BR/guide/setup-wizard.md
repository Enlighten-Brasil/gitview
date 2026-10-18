---
title: O wizard de configuração
description: O que cada passo de /setup faz, o que cai em data/repos/, e como reabrir o wizard depois — ou rodar pnpm setup no terminal.
---

# O wizard de configuração

Na primeira execução o wizard (rota `/setup`) conecta o GitHub, clona os repos escolhidos e roda a primeira coleta. Três passos mais um opcional — e é o único caminho enquanto não existem dados coletados.

## Quais são os passos?

O wizard renderiza fora do shell do dashboard (sem rail/navbar) com o título **Configurar gitview** e um indicador como **passo 1 de 3 — conectar o GitHub**. A sequência:

| # | rota | label do passo (UI) | o que faz |
|---|---|---|---|
| 1 | `/setup/github` | **conectar o GitHub** | autenticar (device flow / PAT / ponte do `gh`) |
| 2 | `/setup/repos` | **escolher repositórios** | escolher org e repos |
| 3 | `/setup/collect` | **clonar e coletar** | clones bare em `data/repos/` + primeira coleta |
| 4 (opcional) | `/setup/team` | **definir o time** | ligar identidades sem mapeamento a devs |

### Passo 1 — conectar o GitHub

O card **Conectar sua conta do GitHub** oferece os três caminhos de autenticação (ver [Conectando o GitHub](./connecting-github.md)). Quando o status mostra **Conectado como @\<login\>**, o botão **continuar** segue para o passo 2.

### Passo 2 — escolher repositórios

O card **Quais repositórios entram no dashboard?** lista os repos da org pela API do GitHub: escolha a org em **organização** (suas orgs mais uma entrada `<login> (pessoal)`), filtre com **buscar repositórios**, marque o que entra. A pré-seleção vem do `GITVIEW_DEFAULT_REPOS` (CSV no `.env`; vazio = todos os não arquivados). Atalhos: **padrão do time** (o CSV), **todos**, **nenhum**. Repos arquivados mostram o badge **arquivado** e não podem ser selecionados. A seleção sobrevive a F5 (guardada no sessionStorage). O botão de envio é **clonar e coletar**.

### Passo 3 — clonar e coletar

Uma tela, duas fases (painel **Clonar e coletar**):

1. **clone** — os repos que faltam viram clones bare em `data/repos/`, em paralelo (pool de 4);
2. **coleta** — a primeira coleta roda com progresso ao vivo via SSE (o log é expansível).

Trocar de rota não mata a execução: ao voltar, o log continua de onde parou. Quando as duas fases terminam, aparece **abrir dashboard** (**voltar** retorna ao passo 2 enquanto ocioso).

O que cai no disco: `data/repos/<repo>` (clones), `data/gitview.db` (SQLite) e `public/data/*.json` (stats, commits, PRs, releases, team). Os JSONs são validados no fim de toda coleta (`check-data.ts`) — erro de validação derruba a coleta.

### Passo 4 — definir o time (opcional)

Só aparece quando a primeira coleta encontrou candidatos — autores de git e logins do GitHub ainda não ligados a nenhum dev. O card conta ("N identidades aparecem sem mapear"); **unificar agora** leva ao editor de identidades em `/teams#sem-mapeamento` e **pular — abrir dashboard** pula. Sem candidatos, o card mostra **Nenhuma identidade sem mapear** e **abrir dashboard** segue direto ao dashboard. Essa é a única rota `/setup/*` que sobrevive ao ter dados — dá para voltar nela depois.

:::info Por que os clones são bare?
Um clone bare não tem working tree — só refs e objetos. Os coletores leem `git log` e `git tag` de lá, nunca de um checkout, então os clones são menores e atualizam mais rápido. Unificar identidades depois só reescreve nomes já gravados no banco numa recoleta — por isso o passo 3 pode rodar de novo pelas Configurações.
:::

## Como reabrir depois?

Com dados coletados, `/setup` redireciona para as Configurações (`/settings`) — o wizard é fluxo de primeira execução. O item **Config** da rail (⚙, só em dev) abre as Configurações. Lá você tem:

- **gerenciar repositórios** — o mesmo picker no modo gerenciar: os repos atuais vêm pré-selecionados com o badge **atual**; desmarcar um avisa que o clone será apagado do disco, e **aplicar mudanças** pede confirmação (**Apagar repositórios do disco?** → **apagar e aplicar**). Remoção é sempre explícita.
- Card **Manutenção dos dados locais** — **recoletar tudo** (re-scan completo), **limpar e recoletar** (apaga banco + JSONs e coleta de novo) e **apagar dados** (apaga sem recoletar — volta ao wizard; os clones ficam, a menos que você marque **apagar também os clones (data/repos)**).

:::warning
O wizard e as Configurações existem só no dev server (`pnpm dev` / `pnpm start`). No build estático (`pnpm build`) os endpoints `/__*` não existem e `/setup` mostra o alerta **Setup disponível apenas em modo dev**.
:::

## E pelo terminal?

`pnpm setup` roda o mesmo fluxo de clone no terminal — útil para automação:

```bash
pnpm setup              # picker interativo ("all" = não arquivados, Enter = GITVIEW_DEFAULT_REPOS)
pnpm setup -- --yes     # sem perguntas: GITVIEW_DEFAULT_REPOS, senão todos os não arquivados
```

Ele usa o token da config (que pode vir do `gh`), clona os repos que faltam em `data/repos/` e grava `GITVIEW_REPOS_ROOT=data/repos` no `.env`. Se já existir uma pasta de repos funcionando fora de `data/repos`, ele pergunta antes de migrar (**Migrar pros clones gerenciados em data/repos? [y/N]**). No fim imprime os próximos comandos (`pnpm collect`, `pnpm dev`).

## Próximos passos

- [Conectando o GitHub](./connecting-github.md) — escolher a credencial.
- [Repositórios](./repositories.md) — como os clones funcionam e como apontar para os seus.
- [Referência: chaves do .env](../configuration/env.md) — toda chave `GITVIEW_*`.
