---
"gitview": patch
---

fix(teams): redirect de nome antigo funciona também com team.json quente (watch do `former` agora com `immediate: true` — antes a página ficava presa no skeleton ao navegar internamente para `/teams/<nome-antigo>` logo após renomear+salvar); matching de nomes normaliza NFC (config NFD do macOS não cai mais em "não encontrado"); POST /__team/config tem timeout de 45s por script-filho (um collect pendurado não trava mais o request); collect-team ignora `renamedFrom` que não seja lista (config editado à mão não gera entradas por caractere)
