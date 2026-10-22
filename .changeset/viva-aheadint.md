---
"gitview": patch
---

branches: viva-sem-PR passa a considerar trabalho não mergeado na integração — branch `feature` sem PR aberto com `aheadProd` 0 e `aheadInt` > 0 (ou vice-versa) caía como feature comum e não casava nenhum derivado; o predicado aceita `aheadProd` > 0 ou `aheadInt` > 0. Os cards de pousadas/abandonadas seguem contando só `aheadProd` > 0, e o tooltip do badge e a doc EN/pt-BR da página branches refletem a regra nova.
