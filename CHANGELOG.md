# gitview

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
