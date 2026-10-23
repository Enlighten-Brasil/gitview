---
"gitview": patch
---

matchesGlob: matcher linear sem regex dinâmica (DP por tokens) no lugar da RegExp montada a partir do glob — elimina o backtracking catastrófico dos `**` vizinhos (padrão `**a`×25 + `z` contra path de 80 chars não resolvia nem em 15s; agora <1ms) e sai ~2× mais rápido no parse do numstat (benchmark 125k pares: 184ms contra 351ms da regex). Semântica byte-idêntica, inclusive nos quirks (NUL do padrão vira `.*`; `**` não engole quebra de linha), provada por tabela-verdade diff-0 contra a implementação regex legada em test/config.test.ts — asserções pinadas intactas, corpus curado e fuzz determinístico de 25k pares. O cache por padrão passa a guardar tokens (mesma razão do follow-up #12).
