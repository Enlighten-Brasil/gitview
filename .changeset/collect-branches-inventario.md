---
'gitview': minor
---

Novo coletor `collect-branches`: inventário de branches por repo no 6º JSON (`branches.json`) — status (production, integration, feature, bot, pousada), ahead/behind SEM merges vs produção e vs a primeira ref de integração, autores à frente com e-mail cru do git (%ae) e linhas +/−. Novas chaves `GITVIEW_BRANCH_STALE_DAYS` (default 30) e `GITVIEW_BOT_BRANCHES`; o `check-data` valida o novo JSON (invariantes + avisos); a recoleta light não toca o `branches.json` (frescor atrelado ao fetch do full); a demo sintetiza branches coerentes com os PRs fictícios.
