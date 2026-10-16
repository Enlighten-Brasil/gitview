---
"gitview": patch
---

fix: triagem dos follow-ups da revisão pré-push (#11) — paleta de time unificada em TEAM_PALETTE (@/team), TeamDraft único exportado, chaves de agregação do collect.ts com separador \u0001 (nomes com '|' não deslocam mais campos), matchesGlob sem placeholder de espaço e case-sensitive como gitignore, ghRetry trata 403/429 com backoff dos headers da API (Retry-After/x-ratelimit-reset) e repete erros de rate limit do body, totals do stats.json derivam das linhas agregadas (+ warning de datas inválidas), comentários corrigidos (RepoReleasesGrid/teams.vue) e 'releases' morto fora da união section
