---
"gitview": patch
---

Corrige as citações restantes da rota antiga `/team` para a canônica `/teams` nos comentários e avisos dos coletores: o cabeçalho do `collect-github.ts`, o aviso de logins sem mapeamento no fim da coleta, o cabeçalho da migração em `lib/legacy.ts` e o cabeçalho do `lib/team.ts`. Mudança apenas de texto, sem efeito de comportamento — o alias `/team` continua existindo para preservar links antigos, e as menções que explicam o alias de propósito (página de times e docs de configuração) ficam como estão.
