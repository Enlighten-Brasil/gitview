---
'gitview': minor
---

Nova página `/branches` (rail entre PRs e Repos): inventário do `branches.json` com três cards de alerta (Pousadas — podem ser limpas; Abandonadas — trabalho não liberado parado; develop × produção por repo), tabela ordenável (branch, repo, status, ahead/behind produção e integração, última atividade, autores à frente, PR, link GitHub) e join branch↔PR via `headRef`/`headRefOid` do `github.json` — status derivados no frontend (`viva-sem-PR`, `pousada-via-squash`), badge de cobertura parcial quando o cache de PRs é antigo ("sem vínculo", nunca "sem PR"), badge de frescor do inventário e mapeamento e-mail→dev via `team.json`. Repos troca de ícone na rail (`i-lucide-folder-git-2`); docs EN + pt-BR em `dashboard/branches.md`.
