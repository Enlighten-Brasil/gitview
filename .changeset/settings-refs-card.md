---
'gitview': minor
---

Novo card "Refs dos repositórios" em Configurações → Geral: edita GITVIEW_PRODUCTION_REF e GITVIEW_INTEGRATION_REFS pela UI (grava no .env linha a linha, preservando comentários e ordem) e mostra um hint somente-leitura com o valor resolvido por repo — o que a coleta vai usar de fato, incluindo o fallback da detecção automática (origin/HEAD → HEAD → main → master) quando a ref explícita não existe no clone. A resolução roda no dev server (endpoint de status estendido com ?refs=1, com cache por processo); ref inexistente não quebra nada — a coleta segue caindo no fallback por repo com aviso.
