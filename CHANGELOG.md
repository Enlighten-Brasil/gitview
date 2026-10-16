# gitview

## 0.35.0

### Minor Changes

- feat: reorganização das dashboards e times de verdade — Visão geral ganha faixa de alertas (PRs parados, merges sem review, ritmo caindo, fora do horário, não liberados, inatividade) com deep-links; "destaque do período" e heatmap de horários mudam para /devs; Saúde funde "Fora do horário" 8 semanas + período num card com toggle; PRs parados e tendência de cycle time mudam para /prs (casa canônica de PR); /releases vira seção de /repos com cadência (releases/mês, dias desde a tag) e a rota antiga redireciona; Times viram filtro na sidebar (chip (des)marca todos os membros); /teams sugere a associação de identidades (tokens do e-mail × nome do dev, pré-selecionado); "salvar + recoletar" usa recoleta leve (?light=1 / collect --reaggregate, sem re-escanear o git); aba "Equipe" renomeada para "Devs"; InactiveWatch rotula que ignora todos os filtros da sidebar

### Patch Changes

- fix: qualidade de dados — datas de commits normalizadas para UTC no banco (migração automática; corrige commits atribuídos à release errada e ordenação dos commits recentes, quebrados por offsets de timezone mistos), contagem de commits por release comparando timestamps em vez de texto, logins do GitHub sem duplicata por case no team.json, métricas de linhas sem lockfiles/arquivos gerados (GITVIEW_EXCLUDE_PATHS com lista padrão; retroage no histórico após `pnpm clean && pnpm collect`), e check-data com invariantes numéricas/datas/ordenação + avisos de qualidade não bloqueantes (membro de time sem mapeamento, dev sem alias, data futura)

## 0.34.0

### Minor Changes

- feat(/teams): editor de times reformulado — cards com métricas, chips de membro e barra de gravação
  
  - Times como cards: avatar de iniciais com a cor do time, nome/descrição inline, paleta de cor em popover (+ hex custom, "sem cor"), membros como chips removíveis e combobox de adição com busca (hint "já em: outro time"; já-marcados saem da lista); remoção com confirmação inline (sem `window.confirm`)
  - **Métricas por time** direto dos dados coletados: devs, commits e PRs (total histórico, o mesmo do ranking — a página não segue o filtro de período, conforme `meta.filters: none`) + "último commit há X"
  - Devs como cards com avatar colorido por nome, cargo/descrição, badges de time com a cor vigente, contagem de aliases (completo no tooltip) e link para o perfil de commits quando o dev tem dados; bots sem botão de edição
  - **Barra sticky de gravação**: status salvo/não salvo, *desfazer* (volta ao último snapshot), *salvar* e *salvar + recoletar*; botões de salvar saem do cabeçalho
  - Skeleton enquanto o `team.json` carrega (o vazio não parece mais "sem time"); preview em chips dos e-mails/logins no modal de perfil
  - helpers de avatar (`initialsOf`/`avatarBgClass`) exportados de `src/team.ts`; tipos compartilhados `TeamDraft`/`TeamMetrics`

## 0.33.0

### Minor Changes

- feat: rotas por pastas (vue-router 5 file-based), guard de dados e setup/settings aninhados
  
  - `vue-router/vite` gera as rotas de `src/pages/` (layouts aninhados `_parent.vue`, route groups `(app)`/`(dashboard)`, `definePage` com meta tipado em `src/router/meta.ts`); mapa commitado em `src/route-map.d.ts` + `handleHotUpdate`
  - **Abas viram rotas**: `/` (Visão geral), `/devs` (Equipe), `/health` (Saúde); hierarquia `/devs/:name` e `/repos/:name` (aliases legados `/dev/:name`, `/repo/:name`, `/team` preservam links antigos; `/?tab=` vira redirect no guard)
  - **Gate de dados no guard global** (`src/router/guards.ts`): boot único do `stats.json` antes de qualquer rota `requiresData`; sem dados cai no wizard; com dados `/setup/*` → `/settings`; passos do wizard validam auth/seleção; splash no App.vue durante o boot; rotas de config bloqueadas no build estático (`requiresServer`)
  - **Setup/settings em rotas**: wizard em `/setup/github|repos|collect` (seleção sobrevive a F5 via sessionStorage) e `/settings` com Geral/Repositórios/Conta; componentes `GithubConnect`/`RepoPicker`/`RunLog` compartilhados
  - Navegação/filtros guiados por `route.meta` (seção da rail, escopo `filters` `full|period|period-bots|none`): `/prs` e `/repos` passam a **mostrar e sincronizar** os filtros que já aplicavam escondidos ("filtro fantasma") — URL compartilha o estado; `activeTab`/`?tab=` sai do urlState
  - `base: '/'` + alias `@` (tsconfig/vite); `App.vue` só casarota; scroll do painel moveu p/ `router/scroll.ts`; página 404 `pages/[...path].vue`
  - Fix: RepoPicker refaz a pré-seleção quando o status chega depois da lista de repos (corrida de montagem; /settings/repos abria sem seleção)
  - Fix: card "apagar dados" limpa o estado na memória e volta ao wizard sem reload; releases.vue agora lista vazio/loading e linka os repos

## 0.32.0

### Minor Changes

- feat: config de máquina no .env, setup com PAT e coletores independentes do gh
  
  - **`.env` + `.env.example`** substituem config.json/config.local.json: chaves `GITVIEW_*` (token, client id, org, reposRoot, defaultRepos, exclude, porta) com precedência shell > .env > default. O `.env` é criado do exemplo na 1ª execução, lido fresco a cada coletor (`envDir: false` no Vite — gravar token no meio do wizard não reinicia/reanca o SSE de coleta) e negado no `server.fs.deny` + watch.
  - **`team.local.json`** (gitignored) passa a ser a única fonte de aliases/perfis/times/bots do time (editável em /team); `config.json` sai do git (nada de pessoal versionado). Migração automática única no primeiro load (legado renomeado `.migrated`). Instrução de pull no README.
  - **Auth do setup**: além do device flow, dá para colar um **PAT** (validado na API antes de gravar) e **desconectar** (`POST /__auth/token` / `/__auth/logout`). `gh auth login` vira ponte opcional — ninguém precisa do gh instalado para coletar/clonar.
  - **Coletores sem `gh`**: `collect-github.ts` usa a API GraphQL via `fetch` com token, `collect-releases.ts` usa REST direto, `scripts/setup.ts` lista org via API. Token injetado no `git clone/fetch` por `GIT_CONFIG_*` (não vaza pro argv nem fica gravado no config dos clones; scrub remove headers antigos).
  - `pnpm start` (alias do dev server) para o fluxo "clonei → install → start".
- 788ffb8: feat: navegação two-pane (rail + painel contextual) e rotas dedicadas para PRs/Repos/Releases
  
  - Novo shell de navegação estilo Sentry: rail de ícones (Visão geral, PRs, Repos, Releases) + painel contextual com sub-navegação, recolhível (persistido em localStorage); navbar antigo com links de abas removido
  - Tabs "Repos" e "PRs" saem do dashboard e viram rotas dedicadas (/repos, /prs); nova página /releases com cards por repo; ?tab= legado redireciona
  - Fix: filtro de período persiste no localStorage e sobrevive à navegação /dev ↔ home (voltar não perde mais o período)
  - Fix: /team — confirmação ao excluir time; guard de alterações não salvas ao trocar de rota e ao fechar a aba (rascunho de time sem nome agora conta como dirty)
  - Fix: tab "Time" → "Equipe" e página de gerenciamento → "Times" (não eram a mesma coisa); select de membros indica quando o dev já está em outro time; /dev inexistente sugere nomes próximos
  - Sidebar de filtros por contexto: oculta em /prs e /releases, reduzida a repositórios em /repos

## 0.31.1

### Patch Changes

- Segurança: ECharts 6 e esbuild 0.28 (alerts do Dependabot)
  
  - `echarts` 5.6.0 → ^6.1.0 (GHSA-fgmj-fm8m-jvvx, XSS em <6.1.0); alinha com o peer `echarts ^6.0.0` do `vue-echarts@8` que já era usado
  - override `esbuild` → ^0.28.2 (GHSA-g7r4-m6w7-qqqr, leitura arbitrária de arquivos no dev server Windows; dependência transitória de `@nuxt/fonts`/`fontless`, só dev)
  - Gráficos validados no browser: todas as abas + `/dev` + `/repo` renderizam sem erros de console no ECharts 6

## 0.31.0

### Minor Changes

- Ferramentas de engenharia: typecheck funcional, code-split por rota e verificação de dados
  
  - `pnpm typecheck` (`tsc --noEmit`) passa a rodar limpo: `@types/node` + shim `*.vue` (`src/vite-env.d.ts`)
  - Code-split por rota no `main.ts` (`defineAsyncComponent`): bundle inicial cai de ~1.38 MB para ~520 kB (base Vue/Nuxt UI); echarts (~628 kB junto com o `ChartPanel`) vira chunk carregado só pelas rotas com gráfico — `/team` e `/setup` não pagam o peso
  - `scripts/check-data.ts`: valida o shape dos 5 JSONs gerados + invariantes do team (membro órfão, candidato bot/ghost, nome duplicado); roda no fim do `pnpm collect` e como 5º passo do `/__collect` — falha de dado aparece como erro na coleta, não como tela quebrada
  - `pnpm check:data` para rodar a validação avulsa

## 0.30.1

### Patch Changes

- Revisão da página /team: bots não vazam mais para devs/candidatos (`team.json` usa o flag `users[].bot` do github.json + regex compartilhado `BOT_LOGIN_RE`; `ghost` — autor de PR apagado — é ignorado); times aparecem no build estático (seed do `team.json`, antes sumiam); "salvar + recoletar" só roda a coleta se o salvar der certo, e o botão exige config carregada (evitava sobrescrever a config por engano com payload vazio); GET `/__team/config` com try/catch e POST rejeita corpo JSON inválido com 400 (antes virava "config vazia" e apagava perfis/times); chaves `__proto__`/`constructor`/`prototype` ignoradas no sanitize; `/__team/github` reporta falhas parciais no campo `warnings` (exibido no modal de import — antes 403 de `read:org` virava "Nenhum time visível" silencioso); bots fora do seletor de membros de time e da lista de associação de candidatos.

## 0.30.0

### Minor Changes

- Página **Time** (`/team`): perfis de devs (título, descrição), unificação de aliases (e-mails de commit e logins do GitHub) e times (nome, descrição, cor, membros) — salvos em `config.local.json` (só na máquina). Importa membros e times da org do GitHub; lista identidades sem mapeamento pra associar a um dev. Os aliases cadastrados já valem na coleta seguinte (merge com `authors`/`githubUsers` do config).

## 0.29.0

### Minor Changes

- Nova ação **"apagar dados"** no setup: limpa banco + JSONs sem recoletar e volta ao assistente de configuração (com checkbox opcional para apagar também os clones em `data/repos` — o "pnpm clean" da UI via `/__clean`). Renomeado "limpar e recomeçar" → "limpar e recoletar" e descrição do card deixada explícita: limpar SEMPRE regenera os dados na sequência (era isso que fazia os dados "voltarem" após o reset).

## 0.28.0

### Minor Changes

- Refina a usabilidade do setup pela UI: quem já tem dados cai direto numa tela de Configurações (repos atuais + gerenciar, manutenção, conta) em vez do wizard de 3 passos; gerenciar repositórios permite remover clones do disco com alerta explícito; corrige o device flow quebrado (o poll era engolido pelo handler de início por casamento de prefixo do connect); sonda de auth a cada 5s na tela de conexão (detecta `gh auth login` e troca de conta, voltando às configurações).

## 0.27.0

### Minor Changes

- feat: filtro de período passa a valer nas páginas /dev/:name e /repo/:name
  
  - cards de commits/linhas, gráficos (timeline, pizza de repos/tipos, heatmap), PRs mergeados, cycle time, reviews e lista de commits respeitam o período; "Tudo" mantém o histórico completo
  - cards que seguem históricos (dias ativos, streak, repos) ganham sufixo "(total)" quando há período ativo; releases e PRs abertos ficam fora do período (marcos/estado atual)
  - header das páginas mostra o range ativo; heatmap mostra o range no título (em "Tudo", cap de 24M do coletor)
  - sidebar mostra só o seletor de período em /dev e /repo (repos/devs só no dashboard); switch de bots visível no dashboard e em /repo (não em /dev)
  - /repo passa a respeitar o switch de bots (commits, tipos, PRs)
  - urlState sincroniza range/from/to/bots também em /dev e /repo; navegação por link preserva o contexto de período entre as páginas e regrava a query da rota

## 0.26.0

### Minor Changes

- Limpeza e read-only reforçado: `pnpm clean` + card "Manutenção dos dados locais" no `/setup` (recoletar tudo / limpar e recomeçar, com `/__collect?clean=1`). Device flow passa a aceitar **GitHub App** (client_id `Iv…`, sem scope — token fisicamente read-only com Contents: read). Clones gerenciados ganham trava de push no git (`remote.origin.pushurl=no-push`, aplicada no clone e a cada coleta) e autenticação via header Basic (`x-access-token`, compatível com PAT/OAuth/GitHub App). Coleta de PRs resiliente: retry em erros transitórios (5xx/rede) e fallback pro cache anterior quando um repo falha — um repo com erro não sai mais zerado do painel no modo completo.

## 0.25.1

### Patch Changes

- Configura o `oauthClientId` do OAuth App da org (device flow habilitado) — passo 1 do `/setup` agora autentica 100% pela UI, sem depender do `gh`.

## 0.25.0

### Minor Changes

- Setup 100% pela UI: rota `/setup` com wizard de 3 passos (conectar GitHub via device flow ou `gh auth login`, escolher org/repos com busca e pré-seleção, clonar e rodar a primeira coleta com progresso ao vivo). Redirecionamento automático na primeira execução sem dados, botão ⚙ no navbar, clone autenticado por token (sem depender do `gh`) e endpoints `/__setup/*` + `/__auth/*` no dev server.

## 0.24.0

### Minor Changes

- config.json agnóstico de máquina: `reposRoot` sai do arquivo versionado (só `config.local.json`/env/auto-detect). Setup pergunta a org quando `githubOrg` não está definido. Documentado que os mapeamentos de identidade (authors/githubUsers/bots) são opcionais — o dashboard funciona sem eles, sem merge de aliases. Coleta remove do banco commits de repos que saíram da seleção (evita dados órfãos ao refazer o setup).

## 0.23.1

### Patch Changes

- AGENTS.md documenta o setup assistido e os clones gerenciados (data/repos, fetch automático, scripts/lib/repos.ts).

## 0.23.0

### Minor Changes

- Setup assistido de repositórios (`pnpm setup`): lista os repos da org via `gh` (sem precisar ter nada clonado), seleção interativa com padrão do time (`defaultRepos` no config), clone bare automático em `data/repos` e `git fetch` incremental a cada coleta. Descoberta de repos centralizada em `scripts/lib/repos.ts` (compatível com clones bare) e compartilhada pelos 3 coletores.

## 0.22.1

### Patch Changes

- AGENTS.md documenta a resolução de config dos coletores (config.local.json, env, auto-detect).

## 0.22.0

### Minor Changes

- Suporte a múltiplas máquinas/devs: caminho dos repositórios agora é configurável por máquina (env `GITVIEW_REPOS_ROOT`, `config.local.json` gitignored ou auto-detect da pasta `../enspace`), com erro amigável quando nada é encontrado. Erro claro também quando o GitHub CLI não está instalado/autenticado. README com passo a passo de onboarding.

## 0.21.0

### Minor Changes

- Aba Repositórios ganha o painel "Linhas adicionadas × removidas": barras de adições (para cima) e remoções (para baixo) por mês com linha de saldo, e modo "acumulado" mostrando o crescimento líquido do código no período — respeita todos os filtros (período, repos, devs, bots).

## 0.20.0

### Minor Changes

- Resumo semanal exportável: botão no navbar abre slideover com o markdown da última semana ISO fechada (commits, PRs, releases, pontos de atenção) comparada com a anterior — copiar para o clipboard ou baixar .md, pronto pra colar em reunião. O navbar também passa a mostrar há quanto tempo os dados foram gerados, com alerta visual após 24h sem coleta.

## 0.19.0

### Minor Changes

- Coleta incremental e atualização de dados pela UI: `collect.ts` usa `git log --since` a partir do watermark no banco (margem de 7 dias, `--full` para re-scan completo), `collect-github.ts` refaz o fetch só de PRs atualizados desde a última coleta (merge com o JSON anterior e expiração fora da janela de 400 dias) e os três coletores processam os repos em paralelo. No dev server, botão ↻ no navbar roda a coleta sem sair da interface (middleware `/__collect` com progresso ao vivo via SSE) e recarrega os dados na hora.

## 0.18.1

### Patch Changes

- docs: AGENTS.md novo (arquitetura, coletores, convenções e regras dos filtros para agentes) e README reescrito cobrindo todo o estado atual (abas, páginas /dev e /repo, releases, filtros, URL e versionamento)

## 0.18.0

### Minor Changes

- aba Saúde completa: PRs parados (14+d), % merge sem review com threshold, inatividade de repos/devs e tendência de cycle time por repo (6 meses). novo: range de datas personalizado (de/até) na sidebar e na URL (?from=&to=), skeletons de carregamento no dashboard e na aba PRs

## 0.17.0

### Minor Changes

- releases: coletor de tags git + releases do GitHub (releases.json), aba Repos vira listagem clicável com última release e commits não liberados, nova página /repo/:name com releases, tipos, PRs e bus factor do repo. fix: heatmap de horários agora respeita o filtro de período (agregação por mês, janela de 24M)

## 0.16.0

### Minor Changes

- aba Saúde vira painel de risco: fix hotspots por repo, gargalo de review, fora do horário no período filtrado e bus factor cruzado com quem revisa (ponto cego quando o dev principal domina as reviews)

## 0.15.0

### Minor Changes

- 5e8b6c0: Novos períodos 1M e 24M (label "último mês" no singular; `?range=1|24` na URL). Cards do período com delta vs janela anterior equivalente (↑/↓ %, colorido para commits/devs/repos, neutro para linhas). Classificação de commits por tipo (conventional commits: feat/fix/refactor/chore/outros) — coletor exporta `monthlyTypes` e a aba Repositórios ganha 2 gráficos: mix por mês e mix % por repo ordenado por taxa de fix. Hashes na página do dev viram links pro commit no GitHub (coletor exporta `repoUrls` a partir dos remotes).

## 0.14.0

### Minor Changes

- 863e679: Página dedicada por dev em rota própria (`/dev/:nome`): clique na linha da tabela de devs abre o perfil com cards (commits, linhas, streak, PRs abertos, cycle time mediano, reviews feitas), commits por semana, distribuição por repo, heatmap de horários, PRs abertos do dev e tabela dos últimos 50 commits (data, repo, hash, mensagem, +/−). Coletor git agora exporta `public/data/commits.json` (últimos 100 commits por autor). Router ganha rotas de verdade (`/` e `/dev/:name`); o detalhe inline (DevDetail) foi removido. Fetches de dados usam caminho absoluto para funcionar em qualquer rota; sync de URL só atua no dashboard e é regravado ao voltar do perfil. Logins SnoopyPRD→Victor Prado e jhmendesenlighten→João Oliveira mapeados.

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
