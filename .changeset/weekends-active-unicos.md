---
'gitview': patch
---

Corrige double-count no burnout.weekendsActive: o campo incrementava +1 por linha de stats.weekly com weekend > 0 na janela das últimas 4 semanas e, como stats.weekly tem uma linha por (semana × repo), o mesmo fim de semana contava várias vezes para o dev que commitou em mais de um repo na semana. A computed burnout agora agrega as semanas ISO únicas por autor com um Set de weekKey e weekendsActive é o tamanho do Set; as somas weekend/night/total continuam aditivas por linha e o número exibido só diminui ou fica igual.
