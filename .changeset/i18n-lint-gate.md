---
'gitview': patch
---

Gate de copy padronizado (issue #254): o `eslint.config.js` passa a incluir o `flat/recommended` do `@intlify/eslint-plugin-vue-i18n` com `localeDir` apontando `src/locales` (que nasce na #252 — sem o catálogo presente o plugin não quebra). `no-missing-keys` e `no-unused-keys` entram como error, `no-raw-text` fica em warn nesta onda (a graduação para error é a #265). O restante do recommended foi auditado na árvore atual: nenhuma regra dispara, então nada foi desligado. O CI não muda — `pnpm lint` já é gate no job `gates`.
