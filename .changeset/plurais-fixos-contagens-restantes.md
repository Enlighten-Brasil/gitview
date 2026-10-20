---
"gitview": patch
---

Labels de contagem restantes fora de `src/components` agora concordam no singular quando o valor é exatamente 1 ("1 dev", "1 commit não liberado", "1 PR aberto", "1 commit", "1 dev ativo", "1 repo ativo", "1 aresta tracejada com seta"), com ternário inline no padrão da casa (decisão da issue #97) em vez de plural fixo: os cards de `/repos/:name` (autores do período, commits não liberados, PRs abertos), o resumo semanal exportável (frase de commits/devs/repos ativos e a linha de release da semana) e os rodapés e o aria-label do grafo de commits ("mostrando X de N commits da janela", "últimos N commits", contagem de arestas tracejadas clipadas e "Grafo dos últimos N commits"). Com contagem maior que 1 nenhum texto muda.
