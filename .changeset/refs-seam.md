---
'gitview': minor
---

Novo seam de refs de produção/integração em scripts/lib/refs.ts, testável por probe e ainda sem consumidores: resolveProdRef (valor explícito da config se existir no repo, senão origin/HEAD → HEAD → main → master, com aviso nomeando o repo no fallback; nada resolvível é erro, nunca vazio silencioso) e resolveIntegRefs (lista da config filtrada por existência no repo, default develop,staging; lista vazia é legítima). Chaves novas GITVIEW_PRODUCTION_REF e GITVIEW_INTEGRATION_REFS no ENV_KEYS, .env.example e docs (EN + pt-BR).
