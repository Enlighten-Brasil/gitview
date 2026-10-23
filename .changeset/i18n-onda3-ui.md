---
"gitview": minor
---

Onda 3 da migração de i18n: 21 componentes compartilhados de tabelas, cards e alertas migram para o catálogo `ui` novo nos três locales (chaves flat com prefixo `ui.`) — títulos de painel, cabeçalhos de coluna, rótulos de card, alertas, aria-labels e notas de rodapé saem dos `.vue` para `t()`, com números por interpolação nomeada. O pt-BR permanece byte-idêntico ao copy atual (prova no teste de paridade e no probe DOM das rotas /prs e /health) e en/es são traduzidos com o mesmo sentido. Rótulos de tabela/card/alerta citados nas páginas EN de docs ganham gloss par em aspas duplas, sem tocar os espelhos pt-BR.
