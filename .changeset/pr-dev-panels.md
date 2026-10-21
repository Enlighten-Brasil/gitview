---
'gitview': patch
---

Painéis de PR/dev distinguem erro de leitura de vazio real e ganham rótulo de janela fixa: a tabela de commits do dev mostra a mensagem de erro do loader quando o commits.json falha (sem mandar rodar o coletor) e mantém o texto de "sem commits no período" só para vazio de verdade; "PRs abertos" (/prs, time e detalhe do dev) ganham o rodapé "janela fixa: abertos agora — segue escopo, ignora o período" e o empty state deixa de alegar filtros de período ("Nenhum PR aberto agora"); o card de PRs parados unifica a fórmula "PR parado há N+ dias" / "PRs parados há N+ dias" no padrão do alerta da visão geral.
