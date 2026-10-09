---
'gitview': minor
---

feat: navegação two-pane (rail + painel contextual) e rotas dedicadas para PRs/Repos/Releases

- Novo shell de navegação estilo Sentry: rail de ícones (Visão geral, PRs, Repos, Releases) + painel contextual com sub-navegação, recolhível (persistido em localStorage); navbar antigo com links de abas removido
- Tabs "Repos" e "PRs" saem do dashboard e viram rotas dedicadas (/repos, /prs); nova página /releases com cards por repo; ?tab= legado redireciona
- Fix: filtro de período persiste no localStorage e sobrevive à navegação /dev ↔ home (voltar não perde mais o período)
- Fix: /team — confirmação ao excluir time; guard de alterações não salvas ao trocar de rota e ao fechar a aba (rascunho de time sem nome agora conta como dirty)
- Fix: tab "Time" → "Equipe" e página de gerenciamento → "Times" (não eram a mesma coisa); select de membros indica quando o dev já está em outro time; /dev inexistente sugere nomes próximos
- Sidebar de filtros por contexto: oculta em /prs e /releases, reduzida a repositórios em /repos
