---
'gitview': patch
---

Guarda de parse no `defineLoader` compartilhado: sob fallback SPA (dev e preview), um `public/data/*.json` ausente devolve `index.html` com status 200, e o `res.json()` sem guarda vazava um erro críptico de parse JSON para a UI. Agora content-type `text/html` ou falha de parse lança o mesmo erro de um 404 real (`opts.httpError(404)` ou `HTTP 404`), preservando a mensagem fixa que cada loader (stats/github/team/commits/releases/branches) já concatena — arquivo não coletado volta a ser reportado como "arquivo ausente", indistinguível do 404 verdadeiro.
