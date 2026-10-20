---
'gitview': patch
---

Cache de memoização por processo e API async opcional no seam de resolução de refs (`scripts/lib/refs.ts`): a resolução repetida do mesmo repo/valor de config passa a custar ~0 (antes cada chamada re-spawnava git por candidato), e `resolveProdRefAsync`/`resolveIntegRefsAsync` liberam o event loop no `GET /__setup/status?refs=1` do dev server e no passe de classificação de escopo do collect — sem mudança de semântica: mesma ordem de resolução, mesmos warns com dedupe por processo, mesmo guard e o mesmo formato de retorno resolvível/display do contrato de refs.
