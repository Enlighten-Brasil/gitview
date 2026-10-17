---
"gitview": patch
---

fix(AppNav): estabilizar o posicionamento do botão de reabrir o painel

A div raiz do AppNav agora tem `relative`, tornando-a o containing block
do botão flutuante 'mostrar painel' (que usa `absolute`). Antes, o
posicionamento dependia de um ancestor externo (o shell sem `relative` em
_parent.vue) e o botão pulava de lugar se algum wrapper ganhasse
`position`. Comportamento visual inalterado.
