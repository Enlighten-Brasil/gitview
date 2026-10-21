---
'gitview': minor
---

Relatórios: a seção Commits dos assuntos organização/time ganha uma linha por dev (`- Nome: N commits (delta) · N PRs mergeados · N reviews`) — com delta absoluto em commits sobre a união das duas janelas (quem sumiu aparece com 0 commits e delta negativo; janela em curso mostra o traço longo) — no lugar do ranking `top devs`. A abertura do relatório vira uma frase de ata determinística logo após o cabeçalho (commits · PRs mergeados · cycle time · releases), com as mesmas regras de omissão do motor. Os textos de release vazia e fora do horário agora rotulam a janela pelo formato (`na semana`/`no mês`/`nos N dias`/`no período`). A degradação de PRs passa a ser por posição da janela (cobertura do `github.json`), eliminando o "0 mergeados" silencioso de janelas fora da cobertura — nesses casos PRs e reviews somem da seção, das linhas por dev e da abertura, com uma única nota.

NOTA: a mudança de bytes do artefato semanal (wrapper `src/summary.ts`) é INTENCIONAL e não deve ser lida como regressão num byte-compare.
