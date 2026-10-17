---
'gitview': minor
---

refactor(format): unifica os formatadores do frontend em `src/format.ts` (issue #32). A formatação vivia espalhada em 10+ arquivos com nomes colidentes e comportamentos divergentes (`fmt` com 4 comportamentos, `fmtDate` com 6 assinaturas, diferença de dias copiada em 6+ lugares, `median`/`fmtDuration` presos em `github.ts`); agora existe um módulo único:

- `fmtInt` (milhar pt-BR) · `fmtCompact` (2,2M / 350k — vírgula decimal) · `fmtRatio` (1 casa decimal com vírgula; sufixos `×`, `/sem`, `/mês` ficam no chamador) · `fmtDuration` (horas → <1h/h/d/sem) · `fmtDate` (dd/mm/aaaa; "—" sem data) · `fmtDay` (dd/mm) · `fmtDateTime` (data + hora) · `fmtDaysAgo` (hoje/ontem/há Nd) · `daysSince` · `median`
- `median` e `fmtDuration` saem de `github.ts` (reexportados lá como compat) e todos os consumidores importam de `src/format.ts`
- separador decimal unificado: `toFixed(1)` com ponto vira vírgula pt-BR em PaceAlert (`média N,N/sem`), DevTable e `/devs/:name` (`commits/dia ativo` — o CSV do DevTable segue com ponto decimal, parseável) e RepoReleasesGrid (`cadência/mês`)
- constantes nomeadas novas em `src/thresholds.ts`: `PR_AGE_AMBER`/`PR_AGE_RED` (bandas de idade do PrOpenTable) e `DELTA_FLAT_PCT` (delta flat do SummaryCards)
- normalização mínima de comportamento: o eixo do LinesFlow passa a compactar a partir de 10k (mesmo limiar dos cards; antes 1k arredondava 2.500 → "3k") e o timestamp de commits em `/devs/:name` ganha os segundos do `toLocaleString` padrão (antes montado à mão sem segundos)
