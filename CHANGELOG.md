# gitview

## 0.13.0

### Minor Changes

- 9872e35: Nova aba "Pull requests" com dados do GitHub (coletados via `gh api graphql` em `public/data/github.json`): cards (abertos, parados +7 dias, mergeados no período, cycle time mediano, % sem review), tabela de PRs abertos ordenada por idade com link pro GitHub, cycle time mediano por repo e reviews por dev (aprovações/pedidos de mudança/comentários). Respeita todos os filtros da sidebar e a URL (?tab=prs). Coletor novo: `pnpm collect:github` (encadeado no `pnpm collect`); mapeamento login→dev em `config.githubUsers` e bots em `config.githubBots`. Tema de gráficos ganhou error500/warning500.

## 0.12.0

### Minor Changes

- f5fa481: Sincroniza aba ativa e filtros (período, repos, devs, bots) com a query string da URL, além do dev em detalhe — links ficam compartilháveis e bookmarkáveis (ex.: `?tab=team&range=6&repos=en-sdk&dev=Raul+Domingues`). Usa replaceState para não poluir o histórico; popstate reseta para os defaults antes de aplicar a URL; valores inválidos (repo/dev que não existe mais) são descartados. Sem parâmetros, a aba cai no localStorage como antes.

## 0.11.1

### Patch Changes

- 4308467: Integra a faixa de abas à moldura do layout: full-bleed, colada sob o navbar (sem padding do body), sticky no scroll com fundo sólido, e label da primeira aba alinhado ao título do navbar/botão de colapso. Detalhe do dev só ocupa espaço quando visível.

## 0.11.0

### Minor Changes

- cd05433: Divide o dashboard em 4 abas (UTabs): Visão geral (cards, timeline, heatmap de atividade), Time (campeões, ritmo, dev × mês, tabela), Saúde (burnout, bus factor) e Repositórios (distribuição, repo × mês). Aba ativa persiste no localStorage.

## 0.10.0

### Minor Changes

- f487f98: Cards de resumo mostram apenas o período selecionado (sem grid duplicado de histórico) com os totais históricos numa linha discreta de contexto. Seleção de repos/devs ganha ações em massa no cabeçalho de cada seção: selecionar todos, inverter seleção e limpar — "todos menos um" fica a 2 cliques (todos → clica no que quer excluir, ou seleciona 1 e inverte).

## 0.9.0

### Minor Changes

- d55686c: Cards de resumo reorganizados: grupos rotulados "no período" (commits, linhas +/−, devs e repos ativos — todos reagem ao seletor de período; agregação mensal do coletor passou a incluir additions/deletions) e "histórico completo" (fixos). Destaque do período sai do grid e vira banner full-width com coroa, nome do dev sem truncamento e % de participação. Navbar sem ícone duplicado de sidebar (o nativo fica só no mobile).

## 0.8.0

### Minor Changes

- 358eaa7: Layout migra para o padrão dashboard do Nuxt UI: filtros saem do painel sticky no topo (que cobria o conteúdo) e viram uma `UDashboardSidebar` recolhível/redimensionável com seções Período/Repos/Devs, badges de contagem de seleção e estado vazio com atalho para reexpandir. Conteúdo fica em `UDashboardPanel` com navbar slim mostrando o período ativo e botão de collapse (1 clique no desktop via `v-model:collapsed`; estado persistido em localStorage).

## 0.7.0

### Minor Changes

- ded91be: Tema ECharts centralizado nos tokens do Nuxt UI: cores, tooltips e rampas de heatmap resolvem as CSS vars do design system em runtime (com conversão oklch→hex, já que canvas não suporta oklch) — trocar a cor primária no vite.config agora reflete em todos os gráficos. Paleta categórica única para séries. Ritmo vertical do layout uniforme (container com gap, sem margens soltas nos painéis) e divisores de seção ("saúde do time", "histórico").

## 0.6.0

### Minor Changes

- a9a843c: Migra o design system para Nuxt UI v4 + Tailwind v4: componentes nativos (UCard, UButton, UBadge, USwitch, UTooltip) em todo o dashboard, tabelas com classes semânticas do tema, ícones Lucide e tokens de cor semânticos. Adiciona vue-router (peer do Nuxt UI) com rotas vazias.

## 0.5.0

### Minor Changes

- 4aea255: Rodada de UI/UX: filtros multi-select substituídos por chips clicáveis (período, repos, devs) com botão "limpar filtros"; filter bar sticky com blur; novo design system — painéis com barra de acento nos títulos, cards com hover, header com gradiente e badge de versão, tabelas e botões polidos.

## 0.4.0

### Minor Changes

- 69b55b3: Burnout watch: painel "fora do horário" com commits de fim de semana e madrugada (22h–6h) por dev nas últimas 8 semanas, % fora do horário, fins de semana ativos nos últimos 4 e status 🟠/🟡/🟢. Respeita filtros de repo/dev/bots.
- 32e3660: Bus factor: painel de concentração por repositório — % de commits de um único dev por repo no período filtrado, com barra visual, devs ativos e nível de risco 🔴/🟡/🟢. Responde "qual repo para se o X sair?".
- 02c9d72: Export PNG em todos os gráficos: novo componente ChartPanel unifica o cabeçalho dos painéis de gráfico (título + ações) e adiciona botão "⬇ PNG" que exporta o chart em alta resolução (pixelRatio 2) com fundo do tema, pronto para colar em apresentação.
- a651850: Coletor: agregação semanal agora separa commits de fim de semana (sáb/dom) e madrugada (22h–6h) por semana/repo/autor — base para o burnout watch. Re-rodar `pnpm collect` atualiza o stats.json sem re-ler o git.

## 0.3.0

### Minor Changes

- 068ffaf: Ranking do time: botão "exportar CSV" (separador `;`, BOM para Excel, respeita ordenação/filtros atuais) e nova coluna "commits/dia ativo".
- 513e52d: Visão individual por dev: clicar numa linha do ranking abre painel de drilldown com cards do dev (commits, dias ativos, streak, commits/dia ativo), timeline semanal completa, distribuição por repositório e heatmap dia × hora pessoal. Ideal para 1:1s.
- aa01847: Painel de ritmo da equipe: compara os commits das últimas 4 semanas com a média semanal das 8 anteriores por dev, destacando quem está abaixo do ritmo (📉 ≤50%) e quem está acelerando (🚀 ≥150%). Respeita filtros de repo/dev/bots, mas tem janela própria de 12 semanas (ignora o filtro de período).

## 0.2.0

### Minor Changes

- Evolução do dashboard: streak de dias consecutivos (atual e recorde) no ranking do time, painel campeão da semana com ranking de títulos, heatmap dev × mês para comparação entre pessoas, e filtro de bots (detectados por sufixo `[bot]` ou `bots` no config.json) com toggle "incluir bots".
