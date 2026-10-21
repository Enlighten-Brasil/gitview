---
"gitview": minor
---

check-data ganha invariantes cross-file no gate: as somas de weekly e monthlyTypes fecham com totals, author e repo de PRs existem em users e stats.repos, todo repo de releases existe no stats e o hash de commits.json é único por (repo, hash) — violação sai com exit 1. Dois avisos não bloqueantes novos: tags com commits=0 além da primeira do repo e commits com assunto de merge e diff +0/-0, lidos do data/gitview.db quando existe — sem o banco o gate segue verde e marca o aviso como não avaliado.
