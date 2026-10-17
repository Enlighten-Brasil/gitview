---
'gitview': patch
---

Corrige o gate `pnpm check:scrub` se auto-flagando: os rótulos literais das tuplas de `TERMS` em `scripts/check-scrub.ts` contiam os próprios termos de identidade (só a regex era montada por fragmento), então o gate saía com exit 1 em qualquer árvore limpa — quebraria o CI em todo push. Rótulo agora também é montado por fragmento; validado nos dois sentidos (árvore limpa → 119 arquivos ok; linha injetada em arquivo tracked → exit 1 com arquivo:linha e termo).
