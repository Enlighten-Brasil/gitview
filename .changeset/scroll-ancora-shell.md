---
'gitview': patch
---

Corrige o scroll das páginas com links de âncora. O wrapper do shell usava `overflow-hidden`, uma caixa de scroll escondida que o `scrollIntoView` da navegação por âncora rolava junto, deslocando o app inteiro para cima e quebrando o gesto de scroll do usuário. Com `overflow-clip` o wrapper deixa de ter área de scroll e apenas o container correto (`.overflow-y-auto`) rola até a âncora — tanto na carga direta da URL com hash quanto no click in-app no link de âncora.
