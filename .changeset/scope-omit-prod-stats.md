---
'gitview': minor
---

Escopo de ref (prod/integration/branch) nos dados exportados: as chaves de agregação de weekly/monthly/heatmap/monthlyTypes incluem o scope do banco e o JSON usa codificação omit-prod (campo `scope` só quando 'integration' ou 'branch'; ausente = produção). `totals` e `perRepo` ganham `prodCommits`/`progressCommits` e a amostra de commits.json viaja com o mesmo encoding. O check-data valida a union fechada do campo e novos invariantes de erro (prod + progresso = total; partição do monthly por presença de scope), com aviso não bloqueante de repo com commits e nenhum em produção; o collect avisa sobre linhas não classificadas (scope NULL, fora de todas as métricas) e commits branch sem ref_hint. A demo sintetiza linhas de progresso coerentes.
