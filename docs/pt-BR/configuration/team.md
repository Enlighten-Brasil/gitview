---
title: Config do time (team.local.json)
description: "O team.local.json: perfis de devs, aliases, times e bots, com o editor da tela /teams."
---

# Config do time (`team.local.json`)

O `team.local.json` é o cadastro do time na sua máquina: nomes canônicos, aliases de identidade, times e bots. É gitignored, JSON puro, editado na tela **/teams** (dev only) e lido a cada execução. Nenhuma limpeza o apaga.

## Formato

```json
{
  "devProfiles": {
    "Ana Souza": {
      "title": "Tech lead",
      "description": "core services, squad plataforma",
      "emails": ["ana@corp.com", "ana.souza@users.noreply.github.com"],
      "githubLogins": ["anasouza"]
    }
  },
  "teams": [
    { "name": "Plataforma", "description": "core services", "color": "#8b5cf6",
      "members": ["Ana Souza", "Bruno Lima"], "renamedFrom": ["Backend"] }
  ],
  "bots": ["meu-bot-interno"],
  "githubBots": ["my-automation-bot"]
}
```

Dá para editar à mão, mas a UI regrava o arquivo inteiro ao salvar. JSON inválido derruba os coletores com `team.local.json inválido: ...`.

## devProfiles

Um perfil por dev, chavado pelo nome canônico: é esse nome que aparece nos dashboards e em `/devs/<nome>`.

| campo | o que faz | formato |
|---|---|---|
| `title` | cargo exibido no card do dev | string |
| `description` | nota livre (foco, squad) | string |
| `emails` | e-mails de commit deste dev | array |
| `githubLogins` | logins do GitHub deste dev | array |

- `emails` + `githubLogins` são os aliases: a coleta converte cada um no nome canônico. Login é comparado sem caixa.
- Sem perfis o dashboard funciona, mas cada e-mail e login vira um autor separado. Esses candidatos aparecem em **Sem mapeamento**.

## teams

| campo | o que faz | formato |
|---|---|---|
| `name` | nome do time e da URL `/teams/<nome>` | string |
| `description` | nota abaixo do título | string |
| `members` | nomes canônicos dos devs | array |
| `color` | cor do badge | hex opcional |
| `renamedFrom` | nomes anteriores do time | array gravado pela UI |

Renomear no editor acrescenta o nome antigo a `renamedFrom`, e `/teams/<nome-antigo>` passa a redirecionar.

## bots e githubBots

- `bots`: nomes de autor no git contados como bot, além dos terminados em `[bot]`.
- `githubBots`: logins somados à lista de fábrica: `dependabot`, `copilot-pull-request-reviewer`, `copilot-swe-agent`, `cursor`, `github-code-quality`.
- Caem na regra automática sem cadastro: login com `[bot]`, terminado em `-bot` ou começando por `dependabot`.
- Bots ficam fora das listas de devs, de times e de candidatos.

## A tela /teams

Só no dev server. No build estático a página vem do `team.json` e é somente leitura.

- **Times** e **Devs**: o card de time edita nome, descrição, cor e membros. **editar perfil** abre modal com título, descrição, e-mails e logins (listas separadas por vírgula).
- **Sem mapeamento**: identidades dos dados sem alias; escolha o dev em **associar a…** e confirme. **importar do GitHub** traz times e membros da org (token com `read:org`) como rascunho, gravado só quando você salva.
- Barra de gravação: **desfazer**, **salvar**, **salvar + recoletar**.

## Quando a mudança vale

- **salvar** regenera o `team.json` na hora: nomes, cores, membros e `renamedFrom` valem já.
- **Aliases** mexem no `stats.json`: só valem depois de re-agregar. Por isso existe o **salvar + recoletar**, sem re-escanear o git, ver [Coletores](../architecture/collectors.md).
- **Remover alias** não renomeia linhas já gravadas no banco. Isso só `pnpm clean && pnpm collect` refaz, ver [Manutenção dos dados](./maintenance.md).

## Próximos passos

- [O arquivo .env](./env.md): config da máquina e as chaves `GITVIEW_*`.
- [O wizard de configuração](../guide/setup-wizard.md): o passo 4 de unificação de identidades.
