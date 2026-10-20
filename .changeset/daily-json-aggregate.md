---
"gitview": minor
---

Novo agregado dia-preciso `public/data/daily.json`, gerado pelo coletor no mesmo passo dos demais agregados e validado pelo check-data como sétimo arquivo fixo. Cada linha traz o dia no fuso canônico, repo, autor, escopo (omit-prod), commits, linhas +/- e as flags de fim de semana e madrugada com os mesmos predicados do agregado semanal — o que permite relatórios com períodos rolantes de 7 e 30 dias cortados por dia, em vez de aproximar semana/mês, cujo erro mediano passa de 100%. O arquivo sai fora do carregamento inicial, como a amostra de commits, e cobre o histórico completo sem corte. A fixture da demo passa a emitir o arquivo derivado dos commits sintéticos, e o tipo `DailyRow` vai para o frontend sem loader nesta etapa.
