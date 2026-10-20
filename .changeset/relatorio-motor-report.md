---
'gitview': minor
---

O resumo semanal exportável vira um motor de relatórios. `buildReport(assunto, de, até)` em `src/report.ts` gera o markdown de qualquer assunto (organização, time ou dev) em qualquer janela, lendo só os payloads dos loaders — nunca o estado reativo dos filtros. A função pura `presetWindow` resolve os presets (semana/mês fechados ou em curso) e o delta compara com a janela anterior imediata, com rótulo por formato (vs semana anterior / vs mês anterior / vs N dias anteriores); janelas em curso e bases zeradas omitem o comparativo. `buildWeeklySummary` passa a ser só o wrapper do preset "semana fechada × organização".

Quando o `daily.json` (agregado dia-preciso) está presente, os relatórios cortam commits por dia, quebram prod/progresso e mostram as linhas de diff da janela; sem ele, somam as semanas do agregado semanal que intersectam a janela e avisam para recoletar. Na saída semanal isso significa exatamente duas linhas a mais que a anterior (comparação byte a byte com o relógio pinado sobre os mesmos dados): a linha nova de diferenças de linhas (`+adicoes/-remocoes`, com a quebra de escopo na mesma linha) e o rodapé da inatividade "(até hoje, independe do período)" — todo o resto do markdown permanece idêntico.

No assunto dev, "top reviewers" vira "reviews feitas"; releases e repositorios inativos ficam restritos a organização/time; PRs em janelas maiores que a cobertura de 400 dias do `github.json` degradam com aviso em vez de subcontar. Novo gate `pnpm check:report` (fixture sintética inline e relógio pinado, seguro para o CI) cobre o motor nos três assuntos, os presets, o delta e o fallback; ele entra no workflow de CI logo após o lint.
