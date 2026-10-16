---
'gitview': minor
---

feat(oss): demo pública no GitHub Pages com fixture sintético — `scripts/make-demo-data.ts` gera devs "Ana"/"Beto" e commits fictícios (com guarda: recusa sobrescrever `public/data/` existente sem `--force`) e o workflow `pages.yml` roda fixture → `check:data` → build com a base do Pages → `404.html` (fallback de SPA) → deploy, com actions pinadas por SHA; router e os 5 loaders de dados passam a respeitar `import.meta.env.BASE_URL` (deep links funcionam sob subpath); scrub final de identidade nos arquivos versionados (exemplos do collect-team.ts e urlState.ts)
