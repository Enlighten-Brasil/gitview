---
'gitview': patch
---

`resolveProdRef`/`resolveIntegRefs` agora retornam o candidato que casou (forma resolvível pelo git): em checkout normal onde a ref de produção só existe como `origin/NOME` (sem branch local), o retorno vem na forma longa `refs/remotes/origin/NOME` em vez do nome curto não-resolvível, que fazia os consumidores git falharem (`rev-list` da classificação de escopo e o ahead/behind do inventário de branches). Em clones bare gerenciados (padrão do produto) o nome curto casa primeiro e o retorno segue byte-idêntico. A exibição não muda: `ref_hint` no banco, `productionRef`/`integrationRefs` do branches.json e o hint de /settings continuam com nome curto via helper exportado `displayRefName`.
