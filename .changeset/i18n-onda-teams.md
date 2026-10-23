---
"gitview": minor
---

Onda 3 da migração de i18n: as páginas do editor de times e do dashboard por time, os componentes de time (card, card de dev, seção de candidatos, import do GitHub, modal de perfil e barra de gravação) e os textos do composable de drafts migram para o catálogo (namespace `team` — títulos, labels, placeholders, aria-labels, chips, combobox, confirmações destrutivas via useConfirm com título/descrição/confirmLabel, toasts de salvamento e erros de rede/serialização), byte-idênticos em pt-BR com `en`/`es` traduzidos. Nomes de times e devs seguem vindo dos dados (identidades não são traduzidas) e a lógica dos drafts não muda — só o copy.
