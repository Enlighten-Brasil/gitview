---
"gitview": minor
---

Onda 3 da i18n: seletor de idioma no navbar (`LangSelect.vue` — opção rotulada no próprio idioma via nativeName, chaves novas `app.lang.*` nos 3 catálogos) com troca em runtime que carrega o chunk lazy ANTES do `applyLocale` (persistência `gitview:lang` e `format.ts` seguem com o slot da #255; detecção de 1º acesso continua no boot) e determinismo das capturas da demo: o Chrome do `demo:shots` ganha `--accept-lang=pt-BR` fixo, travando Accept-Language e `navigator.languages` — shots sempre pt-BR e duas rodadas byte-idênticas em qualquer máquina.
