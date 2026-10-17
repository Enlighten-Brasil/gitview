---
'gitview': patch
---

fix(ui): bugs de apresentação (#29) — separador decimal pt-BR unificado (vírgula) nos formatadores compactos (SummaryCards, devs/[name], repos/[name]), delta flat dos cards mostra o pct real em vez de "0%", tooltip do delta com concordância correta via UTooltip ("vs o mês anterior" no 1M), nome do PNG exportado normaliza acentos (NFD) antes de sanitizar, `Date.now()` do "dias aberto" sai do template (helper `daysOpen`) e o `setTimeout` do "copiado!" no WeeklySummary é limpo no unmount.
