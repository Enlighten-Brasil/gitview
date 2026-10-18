---
title: Config do time (team.local.json)
description: Perfis de devs, aliases, times e bots — o editor /teams, importação do GitHub, candidatos sem mapeamento e dashboards por time.
---

# Config do time (`team.local.json`)

O `team.local.json` é o cadastro do time que vive na sua máquina: perfis de devs, aliases de identidade, times e bots. Ele é gitignored, é a única fonte de nomes canônicos — e nenhuma limpeza o apaga. Tudo é editável na tela **/teams** (dev only; persistido via `POST /__team/config`).

## O que tem no arquivo

O arquivo é JSON puro, escrito pelo editor de `/teams`. Formato:

```json
{
  "devProfiles": {
    "Ana Souza": {
      "title": "Tech lead",
      "description": "foco, squad, observações…",
      "emails": ["ana@corp.com", "ana.souza@users.noreply.github.com"],
      "githubLogins": ["anasouza"]
    }
  },
  "teams": [
    {
      "name": "Plataforma",
      "description": "core services",
      "color": "#8b5cf6",
      "members": ["Ana Souza", "Bruno Lima"],
      "renamedFrom": ["Backend"]
    }
  ],
  "bots": ["meu-bot-interno"],
  "githubBots": ["my-automation-bot"]
}
```

### devProfiles — perfis de devs e aliases

Chaveados pelo nome canônico do dev.

| campo | o que faz | formato |
|---|---|---|
| `title` | Cargo/função mostrado no card do dev (campo **título / cargo** na UI) | string |
| `description` | Nota livre — foco, squad, observações | string |
| `emails` | E-mails de commit que mapeiam para este dev (alias no git) | array de e-mails |
| `githubLogins` | Logins do GitHub que mapeiam para este dev (comparação sem caixa) | array de logins |

Sem perfis o dashboard continua funcionando — cada e-mail/login vira um autor separado e o coletor lista os [candidatos](#sem-mapeamento) pra você ir associando.

### teams — times

| campo | o que faz | formato |
|---|---|---|
| `name` | Nome do time; também a URL do dashboard `/teams/<nome>` | string |
| `description` | Nota livre mostrada abaixo do título | string |
| `color` | Cor do badge (opcional) — o editor oferece uma paleta de 10 cores, um valor customizado e **sem cor** | hex (`#8b5cf6`) |
| `members` | Nomes canônicos dos devs | array |
| `renamedFrom` | Nomes anteriores após um rename em `/teams` — mantém links antigos vivos | array |

### bots e githubBots

- `bots` — nomes canônicos de autor no git tratados como bot (além da regra de fábrica: nomes terminados em `[bot]`).
- `githubBots` — logins do GitHub somados à lista de fábrica (`dependabot`, `copilot-pull-request-reviewer`, `copilot-swe-agent`, `cursor`, `github-code-quality`); logins terminados em `-bot` ou que começam com `dependabot` são detectados automaticamente.

Bots ficam fora das listas de devs e de candidatos — nunca aparecem como membros de time.

## A tela /teams

Rota `/teams` (alias `/team`), dev only — no [build estático](https://github.com/Enlighten-Brasil/gitview/blob/main/README.pt-BR.md#publicar-o-dashboard-build-est%C3%A1tico) a página é somente leitura e renderiza do `team.json`. Três seções, espelhadas na rail lateral: **Times**, **Devs**, **Sem mapeamento**.

**Os cards de time** editam nome (placeholder `Nome do time`), descrição (`descrição (opcional)`), cor (popover com a paleta, **cor personalizada** em `#hex`, e **sem cor**) e membros (chips removíveis mais um combobox com busca `adicionar membro… (busca por nome)`; o hint marca quem já está em outro time). Cada card mostra métricas agregadas (devs, commits, PRs, último commit) e um link **abrir dashboard do time**. **novo time** acrescenta um card; remover um time pede confirmação num modal (**Remover o time "X"?**).

**Os cards de dev** mostram o avatar, badges de time coloridos e a contagem de aliases (detalhe no tooltip). O botão de edição abre o modal de perfil (**perfil de \<nome\>**) com **título / cargo**, **descrição**, **e-mails de commit** e **logins do GitHub** (listas separadas por vírgula), aplicados com **aplicar**.

### Barra sticky de gravação

A barra no rodapé acompanha as alterações não salvas (`alterações não salvas (só nesta máquina até salvar)` / `tudo salvo em team.local.json`) com três ações:

- **desfazer** — volta ao último snapshot salvo (confirmação: "Descartar alterações?").
- **salvar** — grava no `team.local.json` e regenera o `team.json` na hora.
- **salvar + recoletar** — salva e roda a recoleta leve (`/__collect?light=1`: re-agrega com os aliases novos, sem re-escanear o git).

### Importar do GitHub

O botão **importar do GitHub** abre um slideover alimentado por `GET /__team/github`: membros e times da org via API REST. Exige token com `read:org`; falhas parciais (ex.: sem permissão → times vazio) voltam no campo `warnings`, exibido no modal. **importar** adiciona cada time como rascunho, resolvendo logins → devs pelos aliases já mapeados — os membros importados entram com uma contagem do tipo `3/5 membros mapeados — revise e salve`. Nada é persistido até você salvar.

### Sem mapeamento

A seção **Sem mapeamento** lista as identidades vistas nos dados sem alias cadastrado (`team.json#candidates`): autores do git (com seus e-mails) e logins do GitHub (com contagem de PRs/reviews). Escolha um dev em `associar a… (busca por nome)` e confirme com **associar** para prender a identidade àquele perfil.

Candidatos com e-mail corporativo ganham o badge **sugestão**: a sugestão cruza os tokens do local-part do e-mail com os tokens do nome do dev (acentos removidos, ≥2 tokens casando e proporção de match ≥ 0,5). Ela só pré-seleciona o dropdown — o botão vira **confirmar**, mas a associação continua sendo um clique manual.

:::info Por que team.local.json nunca é apagado?
É a única parte não regenerável do conjunto de dados: banco e JSONs podem ser recriados a partir dos repositórios, mas o seu cadastro de nomes canônicos, aliases e times não existe em mais lugar nenhum. `pnpm clean`, **limpar e recoletar** e **apagar dados** pulam esse arquivo de propósito — perdê-lo redividiria cada dev em autores por e-mail sem ninguém perceber.
:::

:::info Por que aliases pedem recoleta?
A resolução de identidade acontece na hora da coleta: os commits coletados já guardam o nome canônico resolvido, no `stats.json`. Salvar regenera o `team.json` (nomes, cores, membros e `renamedFrom` valem imediatamente), mas os aliases só valem quando os dados são re-agregados — para isso existe o **salvar + recoletar**. Remover um alias não reverte nomes já gravados no banco; só um `pnpm clean && pnpm collect` completo refaz.
:::

## Dashboards por time (/teams/\<nome\>)

Cada time ganha um dashboard compartilhável em `/teams/<nome>`: cards de KPI, timeline de commits, heatmap, tipos de commit, resumo de PRs, PRs abertos, cycle time e fora do horário — com os devs **travados nos membros do time**. Período e repos continuam filtráveis; o caminho da URL é o contexto de compartilhamento.

- **Times renomeados mantêm os links antigos**: os nomes são gravados em `renamedFrom` ao salvar, e `/teams/<nome-antigo>` redireciona para o atual.
- **ver como filtro livre** abre o dashboard principal com `?devs=<membros>` como filtro de devs editável — sai do escopo de time e ajusta a seleção.
- Um nome errado mostra **Time não encontrado** com até cinco sugestões de times.

## Próximos passos

- [O arquivo .env](./env.md) — config da máquina e as chaves `GITVIEW_*`.
- [Manutenção dos dados](./maintenance.md) — quando um clean + collect completo é que conserta os números.
