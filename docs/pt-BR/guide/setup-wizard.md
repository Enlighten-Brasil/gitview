---
title: O wizard de configuração
description: "O que cada passo do wizard /setup faz: conectar o GitHub, escolher repos, clonar, coletar e definir o time."
---

# O wizard de configuração

Sem dados coletados, o wizard (rota `/setup`) é o único caminho: conecta o GitHub, clona os repos escolhidos e roda a primeira coleta. São três passos mais um opcional. A UI mostra **Configurar gitview** com o indicador "passo 1 de 3 — conectar o GitHub".

| passo | rota | o que faz |
|---|---|---|
| 1 · conectar o GitHub | `/setup/github` | autentica por device flow, PAT ou ponte do `gh` |
| 2 · escolher repositórios | `/setup/repos` | escolhe a org e marca os repositórios |
| 3 · clonar e coletar | `/setup/collect` | clones bare em `data/repos/` e primeira coleta |
| 4 · definir o time (opcional) | `/setup/team` | liga identidades sem mapeamento a devs |

## Passo 1: conectar o GitHub

Siga um dos três caminhos de autenticação de [Conectando o GitHub](./connecting-github.md). Quando o status mostra **Conectado como @\<login\>**, o botão **continuar** segue para o passo 2.

## Passo 2: escolher repositórios

Escolha a org, busque e marque os repositórios; o botão **clonar e coletar** segue. A pré-seleção vem de `GITVIEW_DEFAULT_REPOS` (vazio = todos os não arquivados) e a seleção sobrevive a F5. Os detalhes do picker estão em [Repositórios](./repositories.md).

## Passo 3: clonar e coletar

Uma tela, duas fases:

1. **clone**: os repos que faltam viram clones bare em `data/repos/`, em paralelo;
2. **coleta**: a primeira coleta roda com progresso ao vivo, em log expansível.

Trocar de rota não interrompe a execução; ao voltar, o log continua de onde parou. No fim, **abrir dashboard** segue para o passo 4 (ou direto para o dashboard) e **voltar** retorna ao passo 2. No disco ficam os clones, o banco em `data/gitview.db` e os JSONs de `public/data/`. Esses JSONs são validados no fim de toda coleta; se a validação falhar, a coleta falha.

## Passo 4: definir o time (opcional)

Só aparece quando a coleta encontrou autores de git ou logins do GitHub sem mapeamento. **unificar agora** abre o editor de identidades em `/teams#sem-mapeamento`; **pular — abrir dashboard** vai direto ao dashboard. Sem candidatos, a tela mostra **Nenhuma identidade sem mapear** e **abrir dashboard** segue direto. É a única rota de `/setup` que continua acessível depois que existem dados.

## Reabrir depois

Com dados coletados, `/setup` redireciona para as Configurações (`/settings`, item **Config** na rail, só em dev). Lá você gerencia repositórios e usa **recoletar tudo**, **limpar e recoletar** ou **apagar dados**; o efeito de cada ação está em [Manutenção dos dados](../configuration/maintenance.md).

:::warning
O wizard e as Configurações só existem no dev server. No build estático (`pnpm build`), `/setup` mostra o alerta **Setup disponível apenas em modo dev**. Sem dados coletados no dist, o alerta também explica o que falta e tem link de saída para a documentação do projeto.
:::

## Pelo terminal

`pnpm setup` roda o mesmo fluxo de clone no terminal:

```bash
pnpm setup              # picker interativo ("all" = não arquivados, Enter = GITVIEW_DEFAULT_REPOS)
pnpm setup -- --yes     # sem perguntas; exige GITVIEW_GITHUB_ORG
```

Ele usa o token do `.env` (ou do `gh`, se logado), clona os repos que faltam em `data/repos/` e grava `GITVIEW_REPOS_ROOT=data/repos` no `.env`. Se já existir uma pasta de repos fora de `data/repos`, ele pergunta antes de migrar. No fim, imprime os próximos comandos.
