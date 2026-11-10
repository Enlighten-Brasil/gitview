---
"gitview": minor
---

feat(relatorios): exportação em PDF nativa com paginação real, links e rodapé

O /reports ganha o botão baixar .pdf no lugar do imprimir: o PDF sai do MESMO markdown congelado do motor (o .md não muda um byte) pelo novo src/report-pdf.ts — parse do dialeto, wrap/layout puros com medida injetada e render jsPDF por import dinâmico (chunk só carrega no clique). A4 tipografado com título, réguas de seção, bullets, rodapé Página X de Y e links de commit clicáveis; o anexo de commits pagina de verdade e o texto é normalizado pro WinAnsi antes de medir/desenhar (medido: o jsPDF re-encoda a linha inteira em UCS-2 e quebra se sobrar char fora do WinAnsi). Novas chaves report.pdf.* nos 3 locales; testes cobrem parse, wrap, paginação e o render real; README e docs/guide/tour.md atualizados.