---
'gitview': minor
---

Sincroniza aba ativa e filtros (período, repos, devs, bots) com a query string da URL, além do dev em detalhe — links ficam compartilháveis e bookmarkáveis (ex.: `?tab=team&range=6&repos=en-sdk&dev=Raul+Domingues`). Usa replaceState para não poluir o histórico; popstate reseta para os defaults antes de aplicar a URL; valores inválidos (repo/dev que não existe mais) são descartados. Sem parâmetros, a aba cai no localStorage como antes.
