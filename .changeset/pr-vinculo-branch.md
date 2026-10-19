---
'gitview': minor
---

PRs coletados agora trazem o vínculo PR↔branch: `headRef`, `baseRef` e `headRefOid` no `github.json` (nomes das branches head/base e SHA do head no momento da coleta). O vínculo sobrevive ao auto-delete da branch em PRs mergeados. Os campos são opcionais: linhas preservadas de caches anteriores continuam sem eles até um `pnpm clean && pnpm collect` completo, que preenche os refs dos PRs históricos. UI trata ref ausente como vínculo desconhecido (cobertura parcial), nunca como PR inexistente.
