---
'gitview': patch
---

testes das libs dos coletores (issue #250): um arquivo de teste por lib — config (matchesGlob + lista default de exclusão), refs, github (fetch stubado), repos, scope e team. Para tornar matchesGlob testável, ela foi extraída de scripts/collect.ts (que auto-executa main no import) para scripts/lib/config.ts, ao lado de DEFAULT_EXCLUDE_PATHS — comportamento byte-idêntico.
