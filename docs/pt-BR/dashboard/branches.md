---
title: Página Branches
description: "Como a página /branches lê o inventário de branches: cards de alerta, status derivados, o join branch↔PR e a tabela ordenável."
---

# Página Branches

`/branches` é a vista do progresso: o inventário de branches coletado pelo `collect-branches` (`branches.json`, só em coletas completas) em join com os pull requests do `github.json`. As fórmulas de ahead/behind e os status do coletor estão em [Coletores](../architecture/collectors.md); os escopos de filtro por rota, em [Regras dos filtros](./filters.md). Se a doc e o código divergirem, o código vence (`src/branches.ts` + `src/pages/(app)/branches.vue`).

## O que a página mostra

- **Badge de frescor** — `inventário …` (agora mesmo / há Nh / há Nd) a partir do `generatedAt` do `branches.json`, com o timestamp exato no tooltip. A recoleta light **não** atualiza o inventário, então o badge fica em cor de aviso após 24h para deixar a idade explícita.
- **Três cards**:
  - **Pousadas — podem ser limpas**: branches com `aheadProd` 0 e `aheadInt` nulo ou 0 (status `pousada` do coletor) ou liberadas via squash-merge (ver abaixo), sem atividade há `GITVIEW_BRANCH_STALE_DAYS`+ dias (default 30). Candidatas a remoção segura.
  - **Abandonadas — trabalho não liberado parado**: `aheadProd` > 0, sem PR aberto, paradas há 30+ dias, não-bot — trabalho que nunca chegou à produção e parou de andar. Disjunto de *Pousadas*.
  - **develop × produção**: mini-lista por repo com os dois desvios da primeira ref de integração contra a produção: à frente = trabalho não liberado; atrás com ahead 0 = integração abandonada (morta). Um contador global único seria ambíguo entre repos, então a lista é por repo.
- **Tabela ordenável** (`.data-table`): branch, repo, status (badge), à frente/atrás da produção, `vs integração` (quando o repo tem ref de integração), última atividade, autores à frente, PR vinculado e link da branch no GitHub. Clicar num card filtra a tabela (chip `só pousadas` / `só abandonadas`, removível) e rola até ela.

O inventário é uma foto do *agora*: o filtro de período não se aplica (como nos PRs abertos) e a página não consome o filtro de escopo de trabalho (`?scope=`). Os filtros de repos, devs e bots da sidebar valem — o filtro de devs mantém as branches com algum dev selecionado entre os autores à frente; o switch de bots controla as branches `bot`.

## Status

Status do coletor (union fechada no `branches.json`): `production` (a ref de produção), `integration` (uma ref de integração), `bot` (nome casa os padrões dependabot/renovate ou `GITVIEW_BOT_BRANCHES`), `pousada` (`aheadProd` 0, `aheadInt` nulo ou 0, e sem atividade há 30+ dias) e `feature` (demais).

Dois status derivados são calculados no frontend a partir do join branch↔PR:

- **viva sem PR** — branch `feature` com `aheadProd` > 0 **ou `aheadInt` > 0** e sem PR aberto: trabalho vivo sem pull request — pendente na produção ou ainda não mergeado na ref de integração. Refs de integração com trabalho parado aparecem no card *develop × produção*; branches de bot seguem o switch da sidebar. O card *Abandonadas* segue contando só `aheadProd` > 0 (trabalho que nunca chegou à produção).
- **pousada via squash** — squash-merge reescreve a história, então a branch mantém `aheadProd` > 0 para sempre mesmo com o trabalho liberado. Só é detectável por um PR MERGED com o mesmo repo e `headRef`, mais `headRefOid` igual ao tip da branch **ou** `mergedAt` maior/igual à última atividade do tip. O teste do `headRefOid` evita falso positivo quando a branch é reutilizada com commits novos após o merge.

## Join branch↔PR e cobertura parcial

O join usa o `headRef` (e o `headRefOid`) do `github.json`. PRs preservados de caches anteriores a esses campos não os carregam, então uma branch sem correspondência mostra **sem vínculo** — nunca "sem PR". Quando parte do cache de PRs não tem `headRef`, a página exibe o badge **vínculo PR↔branch: cobertura parcial (N%)** com a fração coberta; uma recoleta completa do GitHub normaliza. Sem `github.json` algum, a coluna de PR vinculado degrada para *sem vínculo*, os status derivados desligam e um alerta de aviso explica o motivo — a página continua renderizando o inventário.

O PR vinculado exibido por branch é o aberto mais recente; sem PR aberto, o mergeado mais recente. Os autores à frente são e-mails crus do git (`%ae` — fato puramente git, sem recoleta após edição de alias): a página mapeia e-mail → dev via `team.json#devs[].emails` e, sem mapeamento, exibe o e-mail cru.

## Exemplo (dados demo)

Com as fixtures da demo (`demo-api` com a ref de integração `develop`, `demo-web` sem nenhuma): `feat/order-endpoint` (demo-api) aparece como `pousada` — ahead 0, 96 atrás; `develop` entra no card *develop × produção* com +4 à frente; `refactor/auth-service` (demo-web) tem PR aberto (#11), então não é *viva sem PR*; `chore/deps-update` foi apagada após o squash-merge — o `headRef` sobrevive no PR mesmo com a branch removida.

## Relacionado

- [Coletores](../architecture/collectors.md) — como o `branches.json` é produzido (só coletas completas).
- [Modelo de dados](../architecture/data-model.md) — os sete arquivos JSON.
- [Regras dos filtros](./filters.md) — escopo de filtro por rota.
