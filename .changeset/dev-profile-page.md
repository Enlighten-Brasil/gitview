---
'gitview': minor
---

Página dedicada por dev em rota própria (`/dev/:nome`): clique na linha da tabela de devs abre o perfil com cards (commits, linhas, streak, PRs abertos, cycle time mediano, reviews feitas), commits por semana, distribuição por repo, heatmap de horários, PRs abertos do dev e tabela dos últimos 50 commits (data, repo, hash, mensagem, +/−). Coletor git agora exporta `public/data/commits.json` (últimos 100 commits por autor). Router ganha rotas de verdade (`/` e `/dev/:name`); o detalhe inline (DevDetail) foi removido. Fetches de dados usam caminho absoluto para funcionar em qualquer rota; sync de URL só atua no dashboard e é regravado ao voltar do perfil. Logins SnoopyPRD→Victor Prado e jhmendesenlighten→João Oliveira mapeados.
