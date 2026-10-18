---
title: Publicando o build estático
description: O que o pnpm build gera, o que ele deixa de fora, o fallback de SPA que todo host precisa e como a demo pública é deployada.
---

# Publicando o build estático

O `pnpm build` transforma o dashboard num `dist/` 100% estático, sem servidor próprio — o frontend só lê os JSONs de `public/data/`. Esta página cobre o que o build contém, o que ele deixa de fora de propósito e como servi-lo em qualquer lugar.

## O que o `pnpm build` produz?

Uma pasta `dist/` só com arquivos estáticos: sem servidor em runtime, sem banco de dados, sem acesso ao git. Tudo que o dashboard mostra vem dos JSONs copiados de `public/data/` (`stats.json`, `commits.json`, `github.json`, `releases.json`, `team.json`) — nada é recalculado do git no navegador. Qualquer host estático serve.

## O que NÃO existe no build estático?

Os endpoints de escrita (`/__setup/*`, `/__collect`, `/__clean`, `/__team/config`, `/__team/github`) são **middleware do dev server** — o `pnpm build` não os inclui. No build estático o dashboard é somente leitura:

| Recurso | `pnpm dev` | build estático |
|---|---|---|
| `/setup` (wizard de configuração) | funciona | não existe — só funciona sob `pnpm dev` |
| `/settings` | funciona | não existe (rotas `requiresServer` são dev only) |
| Botão de recoleta (↻) | funciona | não renderiza (`import.meta.env.DEV` only) |
| Editor do `/teams` | funciona | desabilitado — `/teams` e `/repos` continuam renderizando os dados dos JSONs, sem os controles de edição |
| Endpoints `/__*` | middleware do dev server | não existem |

Consequência prática: unifique identidades e ajuste os times no dev, recolete, e só então publique. Mudanças de config feitas pela UI nunca chegam a um `dist/` já publicado — dado novo significa build novo.

## Por que deep links precisam de fallback de SPA?

O router usa `createWebHistory`: `/devs/<name>` é uma URL de verdade, não um hash. Quando alguém abre esse link direto (ou dá refresh), o servidor precisa responder com `index.html` — senão o host devolve o próprio 404 e o dashboard nunca sobe.

A configuração mínima por host:

- **GitHub Pages** não tem rewrite rules — o truque é copiar o arquivo de entrada: `cp dist/index.html dist/404.html`. O Pages serve `404.html` para caminhos desconhecidos, e o router assume dali.
- **Netlify** (referência genérica do host — confira a doc do seu): publique `dist/` e adicione um `_redirects`:

```text
/*  /index.html  200
```

- **nginx** (referência genérica do host — confira a doc do seu):

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Vai hospedar em subpasta (tipo `/gitview/`)? Build com a base certa — ver a flag `--base` na seção do GitHub Pages abaixo.

## Qual é o fluxo de publicação?

Três passos, repetidos sempre que os dados mudarem:

1. Na máquina com o token e os clones: atualize os dados (`pnpm collect`, ou o botão ↻ sob `pnpm dev`) e rode `pnpm build`.
2. Sirva `dist/` em qualquer host estático, com o fallback de SPA acima.
3. Dado novo = repita os passos 1–2 periodicamente. Um job de cron/CI com o `GITVIEW_GITHUB_TOKEN` funciona — é exatamente o que o workflow da demo faz, só que sem dado real.

## Como a demo pública é deployada no GitHub Pages?

A demo live roda em https://enlighten-brasil.github.io/gitview/ — só dados sintéticos, nenhum dado real de time. O workflow é o `.github/workflows/pages.yml` ("Deploy demo"): dispara em push para `main`, em `workflow_dispatch` e num schedule mensal (`0 6 1 * *`). Os passos em ordem:

```bash
pnpm exec tsx scripts/make-demo-data.ts   # fixture 100% sintético (devs "Ana"/"Beto", repos demo-*)
pnpm check:data                           # valida shape + invariantes do fixture antes de servir
pnpm exec vite build --base "<base_path>/"  # base calculada pelo actions/configure-pages
cp dist/index.html dist/404.html          # fallback de SPA para o GitHub Pages
```

Depois, `actions/upload-pages-artifact` + `actions/deploy-pages` publicam o `dist/`. Dois detalhes que valem conhecer:

- **Base dinâmica**: o `actions/configure-pages` calcula o `base_path` (raiz em user page, `/gitview/` em project page) e o router casa via `import.meta.env.BASE_URL` — um build serve nos dois casos. O seu deploy no Pages precisa do mesmo tratamento de `--base` se viver em subpasta.
- **O workflow nunca toca dado real**: o fixture é gerado do zero no CI e validado com `pnpm check:data` antes do build.

:::info Por que a demo usa dados sintéticos?
O fixture (`scripts/make-demo-data.ts`) gera devs fictícios ("Ana"/"Beto"), commits fake e repos `demo-*` para a demo pública nunca expor dados reais de um time. As datas se ancoram em "hoje" (UTC) na hora do build, então o dashboard sempre cobre o período default de 12M — o custo é o fixture não ser byte-idêntico entre dias. O script ainda se recusa a sobrescrever `public/data/` existente sem `--force`, para não engolir a coleta de uma máquina de dev.
:::

:::info Por que a demo rebuilda todo mês?
O fixture ancora as datas em "hoje" na hora do build: sem rebuilds, a demo envelheceria para fora dos presets curtos e pareceria "morta". Por isso o `pages.yml` agenda um rebuild mensal ([issue #21](https://github.com/Enlighten-Brasil/gitview/issues/21)) — e porque o GitHub desabilita schedules após ~60 dias sem atividade no repo, o `workflow_dispatch` manual continua disponível como fallback.
:::

## Próximos passos

- [Ambiente de desenvolvimento](../contributing/development.md) — rode o projeto localmente e valide mudanças antes de publicar.
- [Ritual de release](../contributing/release.md) — como mudanças entram, do changeset ao `chore(release)`.
- [README — Publicando o dashboard](https://github.com/Enlighten-Brasil/gitview#publishing-the-dashboard-static-build) — a versão curta deste fluxo.
