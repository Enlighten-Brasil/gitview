---
"gitview": minor
---

Onda 3 da migração de i18n: a página Branches migra para o catálogo (namespace `branches` — status, cards, tabela, tooltips e alertas byte-idênticos em pt-BR, com `en`/`es` traduzidos), junto com as páginas de dados que ela cozinha — `/devs/[name]`, `/prs` e `/repos/[name]` (rótulos dos cards, títulos de gráfico, cabeçalhos e estados vazios da tabela de releases). A mensagem do loader de `branches.json` passa a resolver pelo composer global na falha, mantendo o contrato string do `defineLoader` e só mudando o idioma com o locale, e o badge de frescor da tabela reusa as chaves `navbar.age*` do dataAge. Espaçamento dos nós de texto sai dos literals do template para `${t(...)}` explícito, preservando o DOM byte-idêntico do probe. Docs: gloss dos status derivados citados na página EN de `dashboard/branches.md` (espelho pt-BR sem gloss; paridade garantida pelo `check:docs`).
