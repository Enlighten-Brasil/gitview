---
"gitview": patch
---

chore(collect-team): dedup de renamedFrom por chave NFC

O `team.json` agora deduplica `renamedFrom` por chave `n.normalize('NFC').toLowerCase()`
em vez de por string bruta: o mesmo nome antigo digitado em macOS (NFD) e em outro
sistema (NFC) sobrevivia como DUAS entradas no JSON. Passa a sobrar só a primeira
forma bruta de cada chave (a forma crua é preservada; o que se normaliza é a
comparação), mantendo o descarte quando a chave equivale ao nome atual do time.
