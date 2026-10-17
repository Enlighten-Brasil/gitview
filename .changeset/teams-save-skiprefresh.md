---
'gitview': patch
---

Corrige o botão "salvar" de `/teams`: `@click="save"` repassava o `MouseEvent` nativo para dentro do novo parâmetro `save(skipRefresh)` (o UButton chama `onClick(event)`), então o salvar simples enviava `skipRefresh: true` — o POST pulava a regeneração do `team.json` (chips da sidebar e `/teams/:name` ficavam defasados até uma recoleta manual) e o toast mostrava o texto da recoleta leve. Vira `@click="save()"`.
