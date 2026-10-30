---
"gitview": patch
---

fix(graficos): legenda com nomes dos devs deixa de sobrepor o slider do dataZoom

As legendas de CommitsTimeline e LinesFlow usavam a posicao default do ECharts (base),
caindo exatamente sobre a barra de controle de tempo; posicao agora e explicita no topo.
