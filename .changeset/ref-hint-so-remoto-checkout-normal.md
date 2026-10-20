---
'gitview': patch
---

Documenta a limitação do ref_hint nulo para commits alcançáveis só por remote-tracking refs em checkout normal (clone single-branch, worktree de CI): item novo nas limitações conhecidas dos docs de escopo (par EN+pt-BR) e comentário explicativo em scripts/lib/scope.ts. Acrescentar --remotes ao lado positivo do walk de classificação foi medido num checkout completo (heads locais + remote-tracking) e rejeitado pela regra de reversão da issue: 1 dos 4 ref_hint já atribuídos mudava de x para origin/x a cada coleta, reescrevendo atribuições já gravadas; nos clones bare gerenciados (padrão do produto) o caso nem ocorre. Nenhum comportamento de coleta muda — a saída de classificação segue byte-idêntica.
