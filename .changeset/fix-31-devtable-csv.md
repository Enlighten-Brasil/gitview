---
'gitview': patch
---

fix(tables): CSV do DevTable agora escapa campos no padrão RFC 4180 (aspas duplas com `;` como separador — nomes de dev com `;`, aspas ou quebra de linha reimportam íntegros), unifica `commits/dia ativo` numa fonte única `commitsPerDay` usada pela tabela e pelo CSV (1 casa decimal, antes `toFixed(2)` no CSV vs `toFixed(1)` na tela) e passa a exportar `ultimo_commit` com o mesmo `fmtDate` (fuso local) do template — antes o `slice(0, 10)` do ISO era UTC e podia divergir em 1 dia do valor exibido (mesmo critério aplicado ao nome do arquivo). A regra CSS morta `.dev-row.selected` ganha a classe `:class="{ selected: ... }"` faltante, destacando as linhas cujo dev está no filtro global (`filters.authors`). No mesmo saneamento, remove o CSS morto `.app-title` de `src/main.css` (o `<h1 class="app-title">` sumiu na refatoração two-pane e a regra ficou órfã — sem elemento para reaplicar, o correto é remover).
