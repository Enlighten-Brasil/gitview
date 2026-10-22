---
"gitview": minor
---

`src/format.ts` fica locale-aware: o locale vira estado de módulo (default `pt-BR`, comportamento byte-idêntico ao atual) com o novo `setFormatLocale` para o bootstrap do motor de i18n ligar na onda 2, e toda função de formatação aceita um locale explícito opcional que vence o estado. Unidades de duração (`h`/`d`/`sem`), relativos (`hoje`/`ontem`/`há Nd`) e rótulos de dia da semana viram tabelas internas por locale (pt-BR/en-US/es-ES) — números e datas passam pelo `Intl` com o locale resolvido. Os call sites que escapavam do formatador (o `rangeLabel` dos filtros e o `WEEKDAYS` fixo do heatmap) agora passam pelo `format.ts`.
