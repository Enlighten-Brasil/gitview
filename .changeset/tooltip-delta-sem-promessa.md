---
"gitview": patch
---

O tooltip do delta dos cards do período deixa de prometer comparação quando ela não existe: o ramo "vs a janela anterior equivalente" (usado só em "Tudo", onde o previousTotals retorna nulo e o delta nunca é renderizado) sai de cena e o tooltip passa a existir apenas para janelas comparáveis, na mesma guarda do previousTotals ("Tudo" e range custom ficam sem tooltip). A concordância de cardinalidade fica intacta: "vs o mês anterior" para 1 mês e "vs os N meses anteriores" para N meses.
