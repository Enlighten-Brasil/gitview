---
"gitview": minor
---

refactor(teams): quebra do teams.vue em useTeamDrafts, modais, seção de candidatos e barra de gravação — identidade de time por cid em tudo (sem resolução por índice), toTeamDraft() único em src/team.ts, TeamCard com defineModel/emits tipados (sem mutação de props), métricas/opções por cid em computeds cacheados, payload do GitHub em shallowRef e um só onMounted na página
