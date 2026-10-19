---
'gitview': minor
---

Expurgo de commits inalcançáveis em clones gerenciados: após o fetch --prune e a classificação de escopo, o coletor apaga do banco os commits que não estão mais alcançáveis por nenhuma ref do repo (`git rev-list --all`) — os fantasmas de branches squash-mergeadas e apagadas no remote, que o `INSERT OR IGNORE` nunca expurgava e inflavam o 'Tudo' para sempre. Aplica somente aos clones gerenciados (`data/repos`), recém-atualizados pelo fetch; checkouts normais nunca são expurgados. Efeito retroativo: totais históricos podem diminuir sem fato novo, e o log do coletor é o único rastro.
