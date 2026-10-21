---
'gitview': minor
---

Relatório de organização ganha um bloco de times em Commits: uma linha por time na ordem do team.json com commits e PRs mergeados (autor do PR resolvido por ghName — o login cru zeraria a coluna), seguida da linha de sem time sempre presente — inclusive com 0, que é dado e não ausência — e de um rodapé fixo de sobreposição, já que a soma das linhas excede o total da org quando devs participam de mais de um time. Janela fora da cobertura de PRs emite as linhas só com commits, cobertas pela nota única já existente; os assuntos time e dev seguem sem o bloco.
