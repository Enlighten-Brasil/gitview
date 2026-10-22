---
'gitview': minor
---

Motor de i18n: petite-vue-i18n (alias `vue-i18n`) com catálogos pré-compilados por namespace (`@intlify/unplugin-vue-i18n`) em `src/locales/<locale>/`. pt-BR fica bundled como default e fallback; en-US e es-ES carregam em chunk lazy por locale no boot, antes do mount, com fallback silencioso pro pt-BR se o chunk falhar. A copy da navegação shell (rail, painel contextual, faixa de abas e navbar) foi extraída sem reescrita para as chaves `nav.*`/`navbar.*`/`app.*`; o restante da UI migra em ondas futuras.
