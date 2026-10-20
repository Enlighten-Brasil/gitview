---
title: Grafo de commits
description: "Como a seção #grafo de /repos/:name desenha a janela de commits num grafo de lanes em SVG puro: algoritmo, windowing, cores, interações e a regra da janela fixa."
---
# Grafo de commits

`/repos/:name#grafo` renderiza a janela de commits coletada no `graph-REPO.json` como um **grafo de lanes em SVG puro** (sem ECharts — o bundle de gráficos não cresce). O algoritmo de lanes vive em `src/graph/lanes.ts` (módulo puro validado contra o ground truth do `git log --all --graph --date-order`), o renderer em `src/components/CommitGraph.vue` e o loader por repo em `src/graphData.ts`. Se a doc e o código divergirem, o código vence.

## Janela fixa — os filtros não se aplicam

O grafo mostra os últimos **N commits** do repo (o campo `window` do JSON, rotulado no rodapé) na ordem do `git log --all --date-order`, mais recente primeiro. Ele **ignora de propósito os filtros de período e bots** da rota: remover commits quebraria as cadeias de merge e desfiguraria as lanes (numa janela movimentada, um terço pode ser de merges). É uma *janela fixa intencional* no sentido das regras de filtros — todos os outros painéis da página seguem os filtros, e o rodapé explicita a exceção.

Commits de merge são desenhados como **círculos vazados**: no grafo eles são conectores do desenho (mostram como as lanes se juntam), enquanto todas as métricas continuam excluindo merges.

## O que a seção mostra

- **Lanes** calculadas no cliente (~10 ms para 1.000 commits): a primeira mãe continua na mesma lane; mães extras reusam uma lane que já espera aquele commit ou alocam uma nova à direita; lanes que esperam o mesmo commit colapsam numa curva de junção (como o git desenha). Um pai fora da janela nunca mantém uma lane "zumbi".
- **Windowing vertical**: o render inicial cobre ~40 linhas (cerca de um viewport — medido abaixo do teto de 100 ms no build de produção) e o **"Mostrar mais antigos"** cresce a janela em 300 linhas por clique, no cliente. As lanes são calculadas uma única vez para a janela inteira, então crescer não reembaralha o desenho.
- **Arestas clipadas**: um commit cuja mãe cai fora da janela termina numa **aresta tracejada com marcador de seta** ("continua") — o grafo nunca desenha para uma linha que não existe. O rodapé conta essas arestas.
- **Linhas são links**: cada linha é envolta numa âncora para o commit no GitHub (`repoUrls` do `stats.json` + `/commit/<sha completo>`, nova aba). Passar o mouse mostra um tooltip com o assunto completo, o autor canônico, data/hora (pt-BR), refs e o hash curto.
- **Chips de refs**: os chips acima do grafo listam todas as refs (branches/tags) presentes na janela. Passar o mouse num chip destaca a lane e as linhas que carregam aquela ref; clicar fixa o destaque (clique de novo para soltar).
- **Cores**: as cores de lane vêm da paleta dos gráficos reordenada por distância de matiz no tema escuro (lanes adjacentes ≥ 146°) e de variantes em tons 600 no tema claro (os tons 400 reprovam o piso de contraste WCAG 3:1 sobre branco; o conjunto 600 mede ≥ 3,09:1). A mesma cor acompanha uma branch ao longo de toda a lane.

## Empty state

Sem um `graph-REPO.json` para o repo, a seção mostra *"Sem grafo de commits para esse repo — rode `pnpm collect`"* e o resto da página renderiza normalmente. As fixtures da demo trazem grafos próprios: o `pnpm demo` (`make-demo-data.ts`) emite `graph-demo-api.json`/`graph-demo-web.json` no shape do contrato, com junções de merge visíveis, exatamente uma aresta clipada por repo (um pai fora da janela — a aresta tracejada "continua") e chips de refs nos tips das branches e tags demo. A demo pública renderiza a seção completa, não o empty state.

## Contrato de dados (`graph-REPO.json`)

```jsonc
{
  "generatedAt": "…",
  "repo": "demo-api",
  "window": 1000,
  "commits": [
    {
      "hash": "<40-hex>",          // sha completo — os links do GitHub usam ele
      "parents": ["<40-hex>", …],  // ordem do git: 1º = primeira mãe; [] = root
      "author": "…",               // autor canônico (mapeamento do time; fallback: nome cru do git)
      "date": "…",                 // data do autor, UTC ISO com milissegundos
      "subject": "…",              // %s cru — a truncagem é da UI
      "refs": "(HEAD -> main, tag: v1.0)" // %d cru ou array parseado; vazio = nenhuma
    }
  ]
}
```

Ordem de exibição = a saída preservada do `git log --all --date-order` (descendente). As lanes **não** viajam no JSON: o coletor emite só topologia + metadados e o frontend calcula o desenho — geometria/cores podem iterar sem recoletar.

## Relacionado

- [Coletores](../architecture/collectors.md) — como os arquivos JSON são produzidos.
- [Regras dos filtros](./filters.md) — escopo de filtro por rota e as janelas fixas intencionais.
