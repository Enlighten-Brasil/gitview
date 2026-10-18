---
title: Ritual de release
description: Do changeset ao commit único chore(release), o que o CI exige, como propor mudança e a paridade das docs.
---

# Ritual de release

Toda mudança percorre o mesmo caminho: um changeset, commits de trabalho em pt-BR, o bump de versão, os gates e um commit único `chore(release): X.Y.Z`. Antes do primeiro PR, veja [Ambiente de desenvolvimento](./development.md).

## Os cinco passos

1. **Registre a mudança** com `pnpm changeset` (`minor` = feature, `patch` = fix), commitado junto com o código. PR de código sem changeset volta na revisão.
2. **Commits de trabalho** em pt-BR, Conventional Commits (`feat(...)`, `fix(...)`, `docs(...)`). Commit que fecha issue do roadmap termina o corpo com `Ref: #N`.
3. **Aplique a versão** com `pnpm version:packages`: bumpa o `package.json` e escreve a entrada do `CHANGELOG.md`. Não existe script `version`, então nunca bumpa com `pnpm version` ou `npm version` cru.
4. **Rode os gates**: `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, mais `pnpm check:data` quando mexeu em coletores ou shapes de dados.
5. **Commit de release**: um commit único `chore(release): X.Y.Z` com o bump e o changelog. A versão atual fica no `package.json`, o histórico no `CHANGELOG.md`.

Quem contribui responde pelos passos 1 e 2. Quem mantém aplica os passos 3 a 5. O resto é revisão.

## O que o CI exige

Dois jobs em `.github/workflows/ci.yml`, disparados em todo PR e em push para `main`:

| Job | Passos |
|---|---|
| `gates` | `pnpm install --frozen-lockfile`, `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck`, `pnpm build` |
| `docs` | `pnpm check:docs` (paridade EN e pt-BR) e `pnpm docs:build` (dead link derruba o build) |

Node 22, pnpm do campo `packageManager`, actions pinadas por SHA. O `check:data` fica fora do CI: ele valida `public/data/`, gitignored, que só existe depois de uma coleta local com token.

O `.github/workflows/pages.yml` builda e deploya a demo pública a partir do fixture sintético, com as docs no mesmo artefato. Detalhes em [Publicando o build estático](../guide/publishing.md).

## Roadmap e propostas

O roadmap vive nas [issues do GitHub](https://github.com/Enlighten-Brasil/gitview/issues) e nos milestones; o [`ROADMAP.md`](https://github.com/Enlighten-Brasil/gitview/blob/main/ROADMAP.md) só aponta para lá. O que não está em issue não está planejado.

Para propor uma mudança, abra uma issue com três blocos:

- **Contexto**: que situação motiva a mudança e o que dói hoje.
- **Proposta**: o comportamento desejado, não o detalhe de implementação.
- **Critério**: o que precisa ser verdade para considerar pronto.

Para bug, a receita é mais simples: o que você fez, o que esperava, o que aconteceu. A saída dos coletores e os avisos do `pnpm check:data` amarram o bug mais rápido. A ferramenta é read-only sobre os repos analisados: proposta de escrever neles está fora da linha do projeto.

## Paridade de docs

`README.md` é o documento primário e `README.pt-BR.md` é o espelho seção a seção; a mesma regra vale para `CONTRIBUTING.md` / `CONTRIBUTING.pt-BR.md` e para cada página de `docs/` com seu par em `docs/pt-BR/`. Toda mudança de doc atualiza os dois arquivos no mesmo PR, e o `pnpm check:docs` cobra o par. Todo comando ou label citado precisa existir no `package.json` ou no código.

Mudou um label de UI, um comando, uma chave `GITVIEW_*`, um campo do `team.local.json` ou uma regra de métrica? Atualize no mesmo PR toda página que cita isso e regenere as capturas afetadas com `pnpm.cmd demo:shots`. Página de docs aprofunda o README, não o reescreve.
