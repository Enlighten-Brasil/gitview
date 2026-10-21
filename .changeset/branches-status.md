---
'gitview': patch
---

Branches: a linha de viva-sem-PR envelhecida (≥ BRANCH_STALE_DAYS) passa a renderizar como "abandonada" na tabela — o card Abandonadas já as contava e agora card e tabela concordam; "viva sem PR" fica só para as linhas frescas. A coluna "vs integração" formata as duas metades com separador de milhar (fmtInt), como "à frente"/"atrás". Os previews dos cards viram computeds e o preview de autores vira campo pré-computado na view row — nada de .slice(0, no template.
