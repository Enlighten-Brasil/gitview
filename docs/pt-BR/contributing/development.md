---
title: Ambiente de desenvolvimento
description: Clone, rode e valide o gitview localmente — comandos, gates, convenções e as armadilhas do Windows antes do seu primeiro PR.
---

# Ambiente de desenvolvimento

O gitview é estritamente read-only sobre os repos que analisa: os coletores leem `git log`/tags e a API do GitHub, e geram JSON em `public/data/`. PRs que proponham escrever nos repos analisados não são aceitos. Esta página leva do clone a uma mudança validada.

## Como faço o projeto rodar?

Requisitos (copiados do README — não invente versões):

- **Node 22.13+** — os coletores usam `node:sqlite`, sem flag desde a 22.13; o CI roda Node 22
- **pnpm 11.28** — pinado no campo `packageManager`: rode `corepack enable` uma vez, ou instale o pnpm 11.28 direto

```bash
git clone git@github.com:Enlighten-Brasil/gitview.git
cd gitview
pnpm install
pnpm dev        # http://localhost:5173 — na primeira execução cai no wizard /setup
```

Nada para copiar ou editar: o `.env` é criado sozinho a partir do `.env.example` na primeira execução, e o cadastro do time vive no `team.local.json` (ambos gitignored). Para trabalhar sem a org real, aponte `GITVIEW_REPOS_ROOT` para clones seus — um token com acesso a uma org pública pequena basta.

Uma peculiaridade de supply chain: o repo pina `minimumReleaseAge: 1440` no `pnpm-workspace.yaml`, então só instala pacote publicado há pelo menos 24h. Um bump de dependência recente que esbarre no `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` é esperado — espere a versão amadurecer ou liste-a em `minimumReleaseAgeExclude`.

## Quais comandos existem?

Todos os scripts do `package.json#scripts`, na íntegra:

| Comando | Script | O que faz |
|---|---|---|
| `pnpm setup` | `tsx scripts/setup.ts` | wizard no terminal: escolher/clonar os repos da org |
| `pnpm collect` | `tsx scripts/collect.ts && tsx scripts/collect-github.ts && tsx scripts/collect-releases.ts && tsx scripts/collect-team.ts && tsx scripts/check-data.ts` | os 4 coletores em sequência + validação (incremental) |
| `pnpm check:data` | `tsx scripts/check-data.ts` | validação de shape dos JSONs gerados |
| `pnpm check:scrub` | `tsx scripts/check-scrub.ts` | arquivos tracked devem continuar livres dos termos de identidade do scrub (também é gate de CI) |
| `pnpm collect:github` | `tsx scripts/collect-github.ts` | só PRs/reviews |
| `pnpm collect:releases` | `tsx scripts/collect-releases.ts` | só releases |
| `pnpm collect:team` | `tsx scripts/collect-team.ts` | só o cadastro do time (`team.json`) |
| `pnpm clean` | `tsx scripts/clean.ts` | apaga banco + JSONs (regenerável; `-- --repos` inclui os clones) |
| `pnpm docs:dev` | `pnpm --filter gitview-docs dev` | dev server do site de docs (VitePress, em `docs/`) |
| `pnpm docs:build` | `pnpm --filter gitview-docs build` | builda o site de docs (falha com dead links) |
| `pnpm docs:preview` | `pnpm --filter gitview-docs preview` | serve o site de docs buildado localmente |
| `pnpm dev` | `vite` | dashboard em `http://localhost:5173` |
| `pnpm start` | `vite` | alias do `dev` (setup/coleta só existem no dev server) |
| `pnpm build` | `vite build` | build estático (`dist/` — somente leitura, sem endpoints de setup) |
| `pnpm lint` | `eslint .` | lint (zero erros é requisito) |
| `pnpm lint:fix` | `eslint . --fix` | lint com auto-fix |
| `pnpm typecheck` | `tsc --noEmit` | checagem de tipos (scripts + src) |
| `pnpm preview` | `vite preview` | serve o `dist/` buildado localmente |
| `pnpm changeset` | `changeset` | registrar uma mudança |
| `pnpm version:packages` | `changeset version` | aplicar changesets (bump + CHANGELOG) |

## Quais gates eu rodo antes de um PR?

Não há suíte de testes — estes cinco checks são os gates, e cada um pega uma coisa diferente:

| Gate | O que pega |
|---|---|
| `pnpm lint` | eslint (`@antfu/eslint-config`, config no `eslint.config.js`): estilo e formatação — zero erros é o requisito |
| `pnpm typecheck` | `tsc --noEmit` sobre `scripts/` + `src/` — erros de tipo (templates `.vue` ficam fora) |
| `pnpm build` | `vite build` — o check de compilação; import ou template quebrado falha aqui |
| `pnpm check:data` | shape + invariantes dos JSONs coletados em `public/data/` (também roda no fim do `pnpm collect`) |
| `pnpm check:scrub` | regressões do scrub de identidade — arquivos tracked devem continuar livres dos termos de identidade do empregador removidos ([issue #17](https://github.com/Enlighten-Brasil/gitview/issues/17)) |

O CI (`.github/workflows/ci.yml`) roda `pnpm check:scrub`, `pnpm lint`, `pnpm typecheck` e `pnpm build` em todo PR e em push para `main`. O `check:data` fica fora do CI de propósito.

:::info Por que o CI não roda check:data?
O `check:data` valida `public/data/`, que é gitignored e só existe depois de uma coleta local com token. O CI não coleta e não deve precisar de segredo — então o gate de dados é na sua máquina, logo após o `pnpm collect`.
:::

## Quais convenções são obrigatórias?

- **Toda mudança vem com changeset**: `pnpm changeset` (`minor` = feature, `patch` = fix). Quem mantém aplica com `pnpm version:packages`, que bumpa a versão, escreve o `CHANGELOG.md` e resulta num commit único `chore(release): X.Y.Z`. PR com mudança de código sem changeset vem de volta na revisão.
- **Commits em pt-BR** (Conventional Commits: `feat(...)`, `fix(...)`, `docs(...)`, `chore(release): ...`), código em inglês, comentários em pt-BR. Commits de trabalho que fecham issues do roadmap terminam o corpo com `Ref: #N`.
- **Formatação** é imposta por `pnpm lint` — `@antfu/eslint-config`: sem ponto-e-vírgula, aspas simples. Não brigue com ele; rode `pnpm lint:fix`.
- **Copy de feedback** (padrão unificado): toda ação com efeito emite toast (`useToast`) — título curto em inicial maiúscula ("Perfis salvos"), descrição em minúsculas, `color` sempre explícita. Confirmações destrutivas sempre passam por `useConfirm()` (UModal): `title` = pergunta direta ("Descartar alterações?"), `description` = a consequência concreta, `confirmLabel` = a ação ("descartar", "remover time"). `window.confirm` e modais ad hoc são proibidos.
- **Deleção de arquivos**: `rm -- <path>` (launcher recuperável), nunca `Remove-Item`.

:::info Por que as mensagens de commit são em pt-BR?
O time que constrói e mantém o gitview trabalha em pt-BR, e o histórico de commits é o log de trabalho desse time. Código e docs públicos ficam em inglês para a comunidade open-source usar o projeto. A copy traduzida da UI também é deliberada: a interface do dashboard é em pt-BR.
:::

## O que vive onde no `src/`?

- `data.ts` — filtros globais (`filters`) e agregações filtradas (monthly/weekly/heatmap/types), totais + delta, ritmo, burnout, fora do horário.
- `github.ts` — PRs filtrados, aging, cycle time, reviews por dev, merge sem review.
- `releases.ts` — loader do `releases.json` + métricas (dias desde a última release, cadência).
- `urlState.ts` — filtros na query string (`?range=&from=&to=&repos=&devs=&bots=`), com escopo por `route.meta.filters`.
- `router/` — rotas por arquivo + o guard global; `route.meta` é o contrato (`requiresData`, `onboarding`, `requiresServer`, `setupStep`, `section`, `filters`, `title`).
- `pages/` — um arquivo por rota (shell `(app)/`, abas `(dashboard)/`, `devs/[name]`, `repos/`, `prs`, `teams`, `settings/` dev only, `setup/` dev only, `[...path].vue` 404).
- `components/` — um componente por painel; tabelas usam a classe `.data-table`.

## O que morde no Windows?

- **PowerShell 5.1**: use `pnpm.cmd` — o shim `pnpm.ps1` é bloqueado pela Execution Policy.
- **Nunca edite arquivos UTF-8 via PowerShell** (`Set-Content`, redireção) — sai mojibake. Use um editor de verdade.
- **Nunca piper CLI que muta arquivos por `2>&1 | Select-Object`** — pode abortar o comando no meio.

## Como valido a UI?

Não há suíte de testes, então a validação são os gates mais o olho no app rodando:

1. `pnpm dev` → `http://localhost:5173` e exercite a mudança no navegador.
2. Valide o que de fato renderiza — textos do DOM, tabelas, valores — e fique de olho no console do navegador. O que a página *diz* que mostra é a fonte de verdade, não como um screenshot parece.
3. Tabs do Reka UI não respondem a `.click()` sintético — clique de verdade, ou navegue pela URL (`/devs`, `/health`, …).
4. Feche com os gates: `pnpm lint`, `pnpm typecheck`, `pnpm build` (e `pnpm check:data` quando você mexeu em coletores ou shapes de dados).

## Próximos passos

- [Ritual de release](./release.md) — como a sua mudança entra depois da revisão.
- [Publicando o build estático](../publishing/static-deploy.md) — o que acontece com a saída do `pnpm build` em produção.
- [CONTRIBUTING.pt-BR.md](https://github.com/Enlighten-Brasil/gitview/blob/main/CONTRIBUTING.pt-BR.md) — o guia de contribuição curto do repositório.
