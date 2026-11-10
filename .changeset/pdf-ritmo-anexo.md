---
"gitview": patch
---

fix(relatorios): PDF ganha ritmo de espaçamento e o anexo vira metadado + mensagem

Corrige os espaçamentos do PDF exportado (título/metadados com respiro, linhas de metadado discretas, abertura da ata em corpo maior, seções separadas sem gargalo, bullets com ar) e recompõe a entrada do anexo em duas linhas — metadados (hash · dia · repo · diff · escopo) menores e discretos em cima, mensagem em corpo embaixo — no lugar do bullet único de 6 campos que virava parede de texto. Palavras curtas como o "9" de "9 devs ativos" não terminam mais linha (descem com a palavra seguinte) e as réguas de seção ganharam peso para impressão.