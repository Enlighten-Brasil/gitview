---
title: Ritual de release
description: Do changeset ao commit único chore(release) — além do que o CI exige, onde vive o roadmap e a regra de paridade das docs.
---

# Ritual de release

Toda mudança no gitview percorre o mesmo caminho: um changeset, commits de trabalho em pt-BR, o bump de versão, os gates, e um commit `chore(release): X.Y.Z`. Este mapa é o caminho — siga-o e a revisão continua entediante.

## Como uma release acontece?

Cinco passos, em ordem:

1. **Registrar a mudança** — `pnpm changeset` (`minor` = feature, `patch` = fix), commitado junto com o código. PR com mudança de código sem changeset vem de volta na revisão.
2. **Commits de trabalho** — mensagens em pt-BR, Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`, …). Commits que fecham issues do roadmap terminam o corpo com `Ref: #N`.
3. **Aplicar a versão** — `pnpm version:packages`: bumpa a versão no `package.json` e escreve a entrada no `CHANGELOG.md`. Não existe script `version` no `package.json` — nunca bumpa com `pnpm version`/`npm version` cru.
4. **Rodar os gates** — `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build` (adicione `pnpm check:data` quando mexeu em coletores ou shapes de dados).
5. **Commit de release** — um commit único `chore(release): X.Y.Z` com o bump e o changelog. A versão atual vive no `package.json`; o histórico vive no `CHANGELOG.md`.

Quem mantém aplica os passos 3–5; quem contribui responde pelos passos 1–2. O resto é revisão.

## O que o CI exige?

Dois workflows, dois trabalhos:

- **`.github/workflows/ci.yml`** ("CI") — roda em todo PR e em push para `main`: `pnpm install --frozen-lockfile`, depois `pnpm check:scrub` (anti-regressão do scrub de identidade, [issue #17](https://github.com/Enlighten-Brasil/gitview/issues/17)), `pnpm lint`, `pnpm typecheck`, `pnpm build`. Node 22, pnpm do campo `packageManager`, actions pinadas por SHA (higiene de supply chain em repo público). O `check:data` fica fora de propósito — ele valida `public/data/`, que só existe depois de uma coleta local.
- **`.github/workflows/pages.yml`** ("Deploy demo") — builda e deploya a demo pública no GitHub Pages a partir de um fixture sintético. Detalhes em [Publicando o build estático](../publishing/static-deploy.md).

Se o CI está verde e os gates passam localmente, a mudança está pronta para release.

## Onde fica o roadmap?

Nas [issues do GitHub](https://github.com/Enlighten-Brasil/gitview/issues) e nos milestones — o que não está em issue não está planejado. O [`ROADMAP.md`](https://github.com/Enlighten-Brasil/gitview/blob/main/ROADMAP.md) é intencionalmente minúsculo: sem checklists, sem status, sem regras duplicadas. Para ver o que vem a seguir, abra o milestone atual.

:::info Por que o ROADMAP.md é tão pequeno?
Porque roadmap escrito em markdown apodrece: checklist desatualizado, status duplicado, regra que ninguém sincroniza. O tracker do GitHub já é a fonte de verdade — issues e milestones — então o `ROADMAP.md` só aponta para lá e nunca precisa de manutenção. O que não está em issue não está planejado.
:::

## Como proponho uma mudança?

Abra uma [issue no GitHub](https://github.com/Enlighten-Brasil/gitview/issues) com três seções:

- **Contexto** — que situação motiva a mudança; o que dói hoje.
- **Proposta** — o que você quer mudar, no nível do comportamento (não do detalhe de implementação).
- **Critério** — o que precisa ser verdade para considerar pronto.

Para bugs, a receita é mais simples: o que você fez, o que esperava, o que aconteceu — a saída dos coletores e os avisos do `pnpm check:data` amarram bugs bem mais rápido. Lembre-se: a ferramenta é read-only sobre os repos analisados; propostas de escrever neles estão fora da linha do projeto.

## Por que as docs saem em pares?

O `README.md` (inglês) é o documento primário e o `README.pt-BR.md` é o espelho seção a seção — a mesma regra vale para `CONTRIBUTING.md` / `CONTRIBUTING.pt-BR.md`. Toda mudança de documentação atualiza **os dois** arquivos do par **na mesma** mudança, e todo comando ou label citado precisa existir no `package.json` / nos componentes. Não existe etapa de "traduzir depois": mudança de doc sem par não entra.

:::info Por que docs e README têm pares de idioma?
O projeto é brasileiro em manutenção e open-source em distribuição: o time trabalha em pt-BR, a comunidade lê inglês. Em vez de escolher um idioma e excluir metade do público, cada documento tem um par — `X.md` (primário, inglês) e `X.pt-BR.md` (espelho seção a seção). A regra do "mesma mudança, os dois arquivos" é o que impede o espelho de virar tradução abandonada.
:::

## Próximos passos

- [Ambiente de desenvolvimento](./development.md) — comandos, gates e convenções em detalhe.
- [Publicando o build estático](../publishing/static-deploy.md) — como uma release vira um dashboard live.
- [CHANGELOG.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CHANGELOG.md) — o histórico de releases.
