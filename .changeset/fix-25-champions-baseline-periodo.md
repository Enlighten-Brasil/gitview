---
"gitview": patch
---

fix(WeeklyChampions): baseline das 8 semanas anteriores filtra pelo período

A janela de baseline do campeão da semana agora só considera as semanas
ISO anteriores que caem DENTRO do período filtrado (`inPeriodMonth`).
Antes, semanas anteriores ao início do período contavam como 0, a média
defluía e a razão inflava: no preset 1M a primeira semana do período
aparecia com 116× (baseline 0 → razão = commits puros, volume puro — o
que a issue #10 queria evitar). Semana sem nenhuma semana anterior no
período fica de fora do ranking (sem campeão naquela semana). Com
"Tudo" (sem filtro) `inPeriodMonth` é sempre true — comportamento idêntico
ao atual. Comentário do bloco e rodapé atualizados para refletir a regra.
