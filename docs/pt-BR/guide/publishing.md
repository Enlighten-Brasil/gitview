---
title: Publicando o build estático
description: Como gerar o dist com pnpm build, servir com fallback de SPA e manter a demo do gitview no GitHub Pages.
---

# Publicando o build estático

`pnpm build` gera um `dist/` 100% estático: HTML, JS, CSS e os JSONs coletados. Sem servidor no runtime, sem banco, sem git. Qualquer host estático serve.

## O que entra no build

O dashboard lê só os JSONs de `public/data/`: os 7 fixos — `stats.json`, `daily.json`, `commits.json`, `github.json`, `branches.json`, `releases.json`, `team.json` — mais um `graph-<repo>.json` por repositório para o grafo de commits. Nada é recalculado do git no navegador. Dados novos pedem build novo: rode `pnpm collect` antes de publicar.

## O que não existe no build estático

Os endpoints de escrita (`/__setup/*`, `/__auth/*`, `/__collect`, `/__clean`, `/__team/config`, `/__team/github`) são middleware do dev server e não entram no `dist/`.

| Recurso | `pnpm dev` | Build estático |
|---|---|---|
| `/setup` (assistente) | funciona | não existe |
| `/settings` | funciona | não existe |
| Botão de recoleta (↻) | funciona | não renderiza |
| Edição em `/teams` | funciona | desabilitada |
| Dados de `/teams` e `/repos` | renderizam | renderizam |

Unifique identidades e ajuste os times no dev, recolete, e só então publique: config feita pela UI nunca chega a um `dist/` já publicado.

## Fallback de SPA

O router usa `createWebHistory`: `/devs/<nome>` é URL real. No refresh ou num link direto o host precisa responder `index.html` para caminho inexistente, senão o deep link morre no 404 do servidor.

- **GitHub Pages**: não tem rewrite rules. Copie a entrada: `cp dist/index.html dist/404.html`.
- **Netlify**: `_redirects` na raiz publicada.

```text
/*  /index.html  200
```

- **nginx**:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

- **Subpasta**: passe a base no build, ex.: `pnpm exec vite build --base "/gitview/"`.

## Fluxo de publicação

1. Na máquina com token e clones, atualize os dados: `pnpm collect` (ou o botão ↻ em `pnpm dev`).
2. Gere o build: `pnpm build`.
3. Publique `dist/` com o fallback de SPA acima.
4. Repita os passos 1 e 2 em cron ou job de CI com o `GITVIEW_GITHUB_TOKEN`.

Comandos e gates estão em [Ambiente de desenvolvimento](../contributing/development.md); o caminho da mudança até a versão está em [Ritual de release](../contributing/release.md).

## Deploy da demo no GitHub Pages

A demo em https://enlighten-brasil.github.io/gitview/ vem do `.github/workflows/pages.yml`, disparado em push para `main`, em `workflow_dispatch` e no cron mensal `0 6 1 * *`:

```bash
pnpm exec tsx scripts/make-demo-data.ts   # fixture sintético nos nove JSONs (sete fixos + dois grafos demo)
pnpm check:data                           # valida o fixture antes do build
pnpm exec vite build --base "<base_path>/"
cp dist/index.html dist/404.html          # fallback de SPA
DOCS_BASE="<base_path>/docs/" pnpm docs:build
cp -r docs/.vitepress/dist dist/docs
```

- `actions/configure-pages` calcula o `base_path`: raiz em user page, `/gitview/` em project page. O router usa `import.meta.env.BASE_URL`, então um build serve nos dois casos.
- O site de docs vai no mesmo artefato, sob `dist/docs/`. A base dele vem de `DOCS_BASE`; localmente `pnpm docs:dev` e `pnpm docs:preview` rodam com `DOCS_BASE=/`.
- O fixture é gerado do zero no CI, com devs fictícios ("Ana"/"Beto") e repos `demo-*`. O script recusa sobrescrever `public/data/` existente sem `--force`.
- As datas do fixture se ancoram em hoje (UTC) no momento do build, o que exige o rebuild mensal para a demo não sair dos presets curtos de período. O GitHub desliga schedules após ~60 dias sem atividade no repo: rode `workflow_dispatch` nesse caso.
