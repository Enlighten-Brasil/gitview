---
'gitview': patch
---

CI + deploy do site de docs (issue #73): novo job `docs` na CI roda `check:docs` (gate de paridade EN ↔ pt-BR em `scripts/check-docs.ts`) e `docs:build` como gate de links; o deploy do Pages publica demo e docs no MESMO artefato — docs sob `<base_path>/docs/`.

Ref: #73
