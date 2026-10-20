---
"gitview": patch
---

Remove o código morto de migração única do formato antigo de config (config.json/config.local.json): o scripts/lib/legacy.ts, a chamada em loadConfig e os rastros no .gitignore e no server.fs.deny do vite.config.ts saem — sem usuários externos, o caminho nunca mais roda. Também saem as chaves GITVIEW_EXCLUDE (default vazio, sem efeito na descoberta de repos) e GITVIEW_PORT (o Vite já tem --port e seu próprio default 5173), com os campos Config correspondentes e o argumento órfão de discoverRepos. GITVIEW_EXCLUDE_PATHS e GITVIEW_DEFAULT_REPOS seguem intactos. As páginas configuration/env.md (EN e pt-BR) perdem a seção de ajustes avançados, que só documentava as duas chaves removidas.
