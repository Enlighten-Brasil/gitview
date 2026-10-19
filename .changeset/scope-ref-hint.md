---
'gitview': minor
---

O coletor grava o escopo de ref de cada commit no data/gitview.db: colunas novas scope ('prod' = alcançável da ref de produção; 'integration' = alcançável das refs de integração e não de prod; 'branch' = demais) e ref_hint (nome curto do primeiro ref alcançável, melhor esforço; NULL para alcançável só por tag), com migração in-place idempotente do banco existente — sem necessidade de clean && collect. A classificação roda em todo collect com git via sets completos de git rev-list (consome o seam de refs de scripts/lib/refs.ts) e atualiza só as linhas que mudaram: commit de branch mergeada vira prod sem --full. O --reaggregate segue sem git e, havendo linhas com scope NULL, avisa para rodar pnpm collect sem emitir contagens por escopo. O shape dos JSONs exportados não muda.
