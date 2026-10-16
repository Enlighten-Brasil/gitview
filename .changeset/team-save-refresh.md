---
"gitview": patch
---

fix(teams): salvar na tela /teams regenera o team.json na hora (collect-team + check-data no POST /__team/config) e a UI recarrega — nomes/cores/membros passam a valer imediatamente nos chips da sidebar e no dashboard /teams/<nome> (renames registram renamedFrom no save, sem precisar de recoleta); aliases de identidade seguem pedindo "salvar + recoletar" (continuam no stats.json)
