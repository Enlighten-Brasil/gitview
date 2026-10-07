---
"gitview": minor
---

Layout migra para o padrão dashboard do Nuxt UI: filtros saem do painel sticky no topo (que cobria o conteúdo) e viram uma `UDashboardSidebar` recolhível/redimensionável com seções Período/Repos/Devs, badges de contagem de seleção e estado vazio com atalho para reexpandir. Conteúdo fica em `UDashboardPanel` com navbar slim mostrando o período ativo e botão de collapse (1 clique no desktop via `v-model:collapsed`; estado persistido em localStorage).
