---
"gitview": patch
---

A fixture sintética da demo (`make-demo-data.ts`) passa a emitir `byScope` (eixos `prod`/`progress`, as mesmas 8 medidas da linha) em todas as linhas de `stats.perAuthor`, derivado deterministicamente dos commits sintéticos já gerados — o `snapshot:metrics` sobre a demo deixa de reportar `byScopeRows: 0` e a identidade `prod + progress == linha` passa a ser exercitada nos baselines compartilháveis. O gerador também apaga os `graph-*.json` de `public/data` antes de gravar as saídas: sob um `public/data` com graphs reais pré-existentes, os arquivos que não eram da demo sobravam e o `check:data` emitia avisos de repo fora do `stats.json#repos`.
