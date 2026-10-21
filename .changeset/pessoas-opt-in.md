---
'gitview': minor
---

A seção `## Atenção` dos relatórios ganha opt-in de pessoas: sem `people=1`, as linhas que nomeiam devs (fora do horário % e inativos) não saem mais por padrão — repos sem commit permanecem (higiene de repo, fora do gate de pessoas). O `/reports` ganha o toggle "incluir gestão de pessoas" (`people=1` na URL, sanitização estrita `=== '1'`, nunca persistido no localStorage — a opt-in é deliberada a cada visita); quando ligada, a seção sai completa com o rodapé fixo "métricas de pessoas — não incluir em relatórios para fora do time". O resumo semanal mantém a seção (people: true explícito no wrapper) e a saída byte-idêntica ao buildReport equivalente — paridade wrapper × buildReport com o mesmo opts, verde no check:report; o único acréscimo do artefato é o rodapé de uso interno.
