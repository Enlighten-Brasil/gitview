---
'gitview': patch
---

Corrige o aviso `VUE_ROUTER_R0121` do vue-router no console: `src/urlState.ts` passou a chamar `history.replaceState(history.state, …)` nas duas reescritas de URL (watch de filtros e `afterEach`) em vez de `null`, preservando os metadados internos do router (localização anterior e `scrollPositions`) usados em voltar/avançar.
