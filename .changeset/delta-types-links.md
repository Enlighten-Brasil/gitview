---
'gitview': minor
---

Novos períodos 1M e 24M (label "último mês" no singular; `?range=1|24` na URL). Cards do período com delta vs janela anterior equivalente (↑/↓ %, colorido para commits/devs/repos, neutro para linhas). Classificação de commits por tipo (conventional commits: feat/fix/refactor/chore/outros) — coletor exporta `monthlyTypes` e a aba Repositórios ganha 2 gráficos: mix por mês e mix % por repo ordenado por taxa de fix. Hashes na página do dev viram links pro commit no GitHub (coletor exporta `repoUrls` a partir dos remotes).
