---
"gitview": minor
---

Onda 2 da migração de i18n: a sidebar de filtros migra para o catálogo (namespace `filters` — período, escopo, chips de janela, ações em massa, aria-labels e o tooltip do escopo byte-idêntico ao atual em pt-BR, com `en`/`es` traduzidos), a página 404 ganha as chaves `app.notFound.*` e `meta.title` passa a carregar chave i18n traduzida pelo shell (chave nova `nav.page.settings` para o título de Configurações). O `rangeLabel` traduz no módulo pelo composer global exportado pelo bootstrap, a fiação declarada na #253 ganha o `setFormatLocale` chamado com o locale efetivo (inclusive no fallback do chunk) e o `applyLocale` entrega o slot de troca de locale que o seletor de idioma vai consumir: troca o locale, persiste `gitview:lang` com o storage protegido e acompanha o formato. Docs: glossário par dos rótulos em massa citados em `filters.md`.
