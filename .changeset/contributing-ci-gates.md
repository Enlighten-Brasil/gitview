---
"gitview": patch
---

docs: o par CONTRIBUTING espelha os 4 gates do `ci.yml` na ordem do workflow (`check:scrub`, `lint`, `typecheck`, `build`) — a frase sobre o CI omitia `check:scrub`, e o bloco de gates locais passa a listá-lo. O `check:data` continua fora do CI de propósito: valida `public/data/`, que só existe após coleta local.
