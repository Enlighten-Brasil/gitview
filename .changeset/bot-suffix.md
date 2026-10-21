---
"gitview": patch
---

collect-team: a canonicalização normaliza o sufixo de bot — o autor git "x[bot]" equivale ao login do GitHub "x" e os perfis do team.local.json continuam válidos (merge por nome normalizado). O team.json deixa de ter pares de dev bot duplicados (cards repetidos no editor de time) e o check:data passa a rejeitar pares que colidam só pelo sufixo.
