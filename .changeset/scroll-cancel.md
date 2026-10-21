---
'gitview': patch
---

Scroll de âncora ganha cancelamento por navegação: os timers do retry (poll 100ms até 50×) e dos re-scrolls (500/1500ms após o render dos gráficos) agora são guardados e limpos no `afterEach` seguinte — antes, timers de uma navegação antiga seguiam rolando a página por até ~5s e podiam rolar a rota nova quando o mesmo `id` existia nela. A navegação com âncora válida mantém o comportamento atual (scroll até a seção + re-scrolls após o render dos gráficos).
