---
'gitview': patch
---

fix(teams): :key duplicado nos badges, dirty sensível à ordem de chaves e cor hex inválida aceita

- badges de e-mails/logins no editor de perfil renderizam a lista deduplicada (Set sobre o split) e o `confirmEdit` normaliza as listas, impedindo duplicatas de persistir no `team.local.json`
- `dirty` passa a comparar os snapshots com serialização estável (chaves de objeto ordenadas), eliminando o aviso de "alterações não salvas" fantasma sem mudança real
- cor hex custom do TeamCard restrita a 3/6/8 dígitos (`#rgb`, `#rrggbb`, `#rrggbbaa`) com mensagem de erro visível no campo (`use #rgb, #rrggbb ou #rrggbbaa`) em vez de descartar hex inválido em silêncio
