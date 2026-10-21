# gitview

## 0.63.0

### Minor Changes

- 19d5b30: O /reports ganha preview renderizado do relatório (com toggle para o markdown cru) e botão de impressão com @media print — Ctrl+P sai só com o relatório na página, PDF pelo navegador, sem lib nova. O markdown copiado/baixado não muda, byte a byte.
- 8300087: Relatório de organização ganha um bloco de times em Commits: uma linha por time na ordem do team.json com commits e PRs mergeados (autor do PR resolvido por ghName — o login cru zeraria a coluna), seguida da linha de sem time sempre presente — inclusive com 0, que é dado e não ausência — e de um rodapé fixo de sobreposição, já que a soma das linhas excede o total da org quando devs participam de mais de um time. Janela fora da cobertura de PRs emite as linhas só com commits, cobertas pela nota única já existente; os assuntos time e dev seguem sem o bloco.

## 0.62.0

### Minor Changes

- f0e7316: Relatórios: a seção Commits dos assuntos organização/time ganha uma linha por dev (`- Nome: N commits (delta) · N PRs mergeados · N reviews`) — com delta absoluto em commits sobre a união das duas janelas (quem sumiu aparece com 0 commits e delta negativo; janela em curso mostra o traço longo) — no lugar do ranking `top devs`. A abertura do relatório vira uma frase de ata determinística logo após o cabeçalho (commits · PRs mergeados · cycle time · releases), com as mesmas regras de omissão do motor. Os textos de release vazia e fora do horário agora rotulam a janela pelo formato (`na semana`/`no mês`/`nos N dias`/`no período`). A degradação de PRs passa a ser por posição da janela (cobertura do `github.json`), eliminando o "0 mergeados" silencioso de janelas fora da cobertura — nesses casos PRs e reviews somem da seção, das linhas por dev e da abertura, com uma única nota.
  
  NOTA: a mudança de bytes do artefato semanal (wrapper `src/summary.ts`) é INTENCIONAL e não deve ser lida como regressão num byte-compare.

## 0.61.1

### Patch Changes

- b57f6d3: Capturas de docs e README regeneradas depois que a seção Relatórios entrou na rail de navegação: as 6 telas commitadas mostravam a rail antiga sem a nova seção. Regeneradas somente sobre o fixture sintético da demo (guard do script negado antes, provado com exit 1 sobre dados reais), com leitura visual de cada PNG confirmando a rail, o tema escuro e apenas identidades fictícias.

## 0.61.0

### Minor Changes

- b11a386: Página de Relatórios (/reports): relatório exportável em markdown com assunto (organização, time do team.json ou dev sem bot), seis presets de período e a query da URL como fonte única reproduzível, com copiar/baixar .md compartilhado com o resumo semanal pela nova composable useMarkdownExport.

## 0.60.0

### Minor Changes

- 32984c6: O resumo semanal exportável vira um motor de relatórios. `buildReport(assunto, de, até)` em `src/report.ts` gera o markdown de qualquer assunto (organização, time ou dev) em qualquer janela, lendo só os payloads dos loaders — nunca o estado reativo dos filtros. A função pura `presetWindow` resolve os presets (semana/mês fechados ou em curso) e o delta compara com a janela anterior imediata, com rótulo por formato (vs semana anterior / vs mês anterior / vs N dias anteriores); janelas em curso e bases zeradas omitem o comparativo. `buildWeeklySummary` passa a ser só o wrapper do preset "semana fechada × organização".
  
  Quando o `daily.json` (agregado dia-preciso) está presente, os relatórios cortam commits por dia, quebram prod/progresso e mostram as linhas de diff da janela; sem ele, somam as semanas do agregado semanal que intersectam a janela e avisam para recoletar. Na saída semanal isso significa exatamente duas linhas a mais que a anterior (comparação byte a byte com o relógio pinado sobre os mesmos dados): a linha nova de diferenças de linhas (`+adicoes/-remocoes`, com a quebra de escopo na mesma linha) e o rodapé da inatividade "(até hoje, independe do período)" — todo o resto do markdown permanece idêntico.
  
  No assunto dev, "top reviewers" vira "reviews feitas"; releases e repositorios inativos ficam restritos a organização/time; PRs em janelas maiores que a cobertura de 400 dias do `github.json` degradam com aviso em vez de subcontar. Novo gate `pnpm check:report` (fixture sintética inline e relógio pinado, seguro para o CI) cobre o motor nos três assuntos, os presets, o delta e o fallback; ele entra no workflow de CI logo após o lint.

## 0.59.0

### Minor Changes

- e182992: Novo agregado dia-preciso `public/data/daily.json`, gerado pelo coletor no mesmo passo dos demais agregados e validado pelo check-data como sétimo arquivo fixo. Cada linha traz o dia no fuso canônico, repo, autor, escopo (omit-prod), commits, linhas +/- e as flags de fim de semana e madrugada com os mesmos predicados do agregado semanal — o que permite relatórios com períodos rolantes de 7 e 30 dias cortados por dia, em vez de aproximar semana/mês, cujo erro mediano passa de 100%. O arquivo sai fora do carregamento inicial, como a amostra de commits, e cobre o histórico completo sem corte. A fixture da demo passa a emitir o arquivo derivado dos commits sintéticos, e o tipo `DailyRow` vai para o frontend sem loader nesta etapa.

## 0.58.1

### Patch Changes

- Corrige o loop /setup em instância nova: os JSONs de `public/data/` escritos depois do boot do dev server passam a ser servidos por middleware `/data/*` no collect-plugin (lê direto do disco). Sem isso, a 1ª coleta do wizard ficava invisível — o boot recebia index.html no lugar do stats.json, o guard mandava /setup para sempre e o wizard parecia reiniciar. Causa: `fs.deny '**/data/**'` + snapshot `publicFiles` do Vite (que só conhece arquivo de `public/` visto no boot, já que o watcher ignora `**/data/**`).

## 0.58.0

### Minor Changes

- Diagnóstico multiplataforma: novo `pnpm diagnose` (pré-flight de máquina — Node 22.13+/node:sqlite, dependências, git, token, pasta de repositórios, permissões de escrita, fuso e GitHub API) e log de execução dos 7 scripts de coleta com timestamp relativo + espelho em `data/logs/` (um arquivo por passo, últimos 30 mantidos) + heartbeat de 30s de silêncio — uma coleta travada agora mostra em qual passo parou. `gitAuthEnv` passa a ser nunca interativo (credential helper do sistema resetado + GCM/askpass desligados): fetch sem credencial falha rápido e o coletor segue com o cache local, em vez de abrir diálogo e travar a coleta sem erro aparente. Coleta ganha linha de progresso por repo nas fases longas (git log --numstat e classificação de escopo) e anúncio antes das migrações do banco. `package.json` declara `engines.node >= 22.13.0` (linha mínima do node:sqlite sem flag). FAQ (EN + pt-BR) e READMEs documentam o fluxo de diagnóstico remoto.

## 0.57.3

### Patch Changes

- cbfeb25: Remove o código morto de migração única do formato antigo de config (config.json/config.local.json): o scripts/lib/legacy.ts, a chamada em loadConfig e os rastros no .gitignore e no server.fs.deny do vite.config.ts saem — sem usuários externos, o caminho nunca mais roda. Também saem as chaves GITVIEW_EXCLUDE (default vazio, sem efeito na descoberta de repos) e GITVIEW_PORT (o Vite já tem --port e seu próprio default 5173), com os campos Config correspondentes e o argumento órfão de discoverRepos. GITVIEW_EXCLUDE_PATHS e GITVIEW_DEFAULT_REPOS seguem intactos. As páginas configuration/env.md (EN e pt-BR) perdem a seção de ajustes avançados, que só documentava as duas chaves removidas.
- 0af45e3: Capturas das telas da doc regeneradas sobre a fixture sintetica depois da correcao de plurais (#159): o rodape do grafo de commits e os cards de /repos/:name passam a mostrar a forma singular quando a contagem e 1 (a demo emite exatamente 1 aresta clipada e 1 PR aberto).

## 0.57.2

### Patch Changes

- c022d90: Novos scripts `collect:full` e `collect:reaggregate` no `package.json`: as flags `--full`/`--reaggregate` só eram alcançáveis rodando `tsx scripts/collect.ts` diretamente — um `pnpm collect -- --full` repassava a flag só ao último comando da cadeia (`check-data.ts`, que não a conhece). `collect:full` roda a mesma cadeia do `collect` com `--full` em `collect.ts` e `collect-github.ts` (os únicos que leem a flag); `collect:reaggregate` espelha o passo light do dev server (`collect.ts --reaggregate` + `collect-github.ts` incremental + `collect-team.ts` + `check-data.ts`, sem git scan nem releases/branches/graph). Docs (EN+pt-BR) alinhadas aos novos atalhos em collectors, development, maintenance e env, mais os READMEs.
- 54448fa: A fixture sintética da demo (`make-demo-data.ts`) passa a emitir `byScope` (eixos `prod`/`progress`, as mesmas 8 medidas da linha) em todas as linhas de `stats.perAuthor`, derivado deterministicamente dos commits sintéticos já gerados — o `snapshot:metrics` sobre a demo deixa de reportar `byScopeRows: 0` e a identidade `prod + progress == linha` passa a ser exercitada nos baselines compartilháveis. O gerador também apaga os `graph-*.json` de `public/data` antes de gravar as saídas: sob um `public/data` com graphs reais pré-existentes, os arquivos que não eram da demo sobravam e o `check:data` emitia avisos de repo fora do `stats.json#repos`.
- 3325108: Labels de contagem restantes fora de `src/components` agora concordam no singular quando o valor é exatamente 1 ("1 dev", "1 commit não liberado", "1 PR aberto", "1 commit", "1 dev ativo", "1 repo ativo", "1 aresta tracejada com seta"), com ternário inline no padrão da casa (decisão da issue #97) em vez de plural fixo: os cards de `/repos/:name` (autores do período, commits não liberados, PRs abertos), o resumo semanal exportável (frase de commits/devs/repos ativos e a linha de release da semana) e os rodapés e o aria-label do grafo de commits ("mostrando X de N commits da janela", "últimos N commits", contagem de arestas tracejadas clipadas e "Grafo dos últimos N commits"). Com contagem maior que 1 nenhum texto muda.
- f643eed: Documenta a limitação do ref_hint nulo para commits alcançáveis só por remote-tracking refs em checkout normal (clone single-branch, worktree de CI): item novo nas limitações conhecidas dos docs de escopo (par EN+pt-BR) e comentário explicativo em scripts/lib/scope.ts. Acrescentar --remotes ao lado positivo do walk de classificação foi medido num checkout completo (heads locais + remote-tracking) e rejeitado pela regra de reversão da issue: 1 dos 4 ref_hint já atribuídos mudava de x para origin/x a cada coleta, reescrevendo atribuições já gravadas; nos clones bare gerenciados (padrão do produto) o caso nem ocorre. Nenhum comportamento de coleta muda — a saída de classificação segue byte-idêntica.
- 057ca0d: O tooltip do delta dos cards do período deixa de prometer comparação quando ela não existe: o ramo "vs a janela anterior equivalente" (usado só em "Tudo", onde o previousTotals retorna nulo e o delta nunca é renderizado) sai de cena e o tooltip passa a existir apenas para janelas comparáveis, na mesma guarda do previousTotals ("Tudo" e range custom ficam sem tooltip). A concordância de cardinalidade fica intacta: "vs o mês anterior" para 1 mês e "vs os N meses anteriores" para N meses.

## 0.57.1

### Patch Changes

- 5eec88b: Cache de memoização por processo e API async opcional no seam de resolução de refs (`scripts/lib/refs.ts`): a resolução repetida do mesmo repo/valor de config passa a custar ~0 (antes cada chamada re-spawnava git por candidato), e `resolveProdRefAsync`/`resolveIntegRefsAsync` liberam o event loop no `GET /__setup/status?refs=1` do dev server e no passe de classificação de escopo do collect — sem mudança de semântica: mesma ordem de resolução, mesmos warns com dedupe por processo, mesmo guard e o mesmo formato de retorno resolvível/display do contrato de refs.
- fc3af4f: O passeio pelo dashboard passa a cobrir a página /branches (cards Pousadas/Abandonadas/develop × produção e a tabela ordenável), a seção Branches da rail e o grafo de commits da seção #grafo de /repos/:name, cada um com labels conferidos nos componentes e capturas novas da demo sintética das duas telas; o texto dos cards históricos do perfil do dev descreve o sufixo (total) como ele passou a ser desde o recorte de escopo por byScope, e o development.md lista os módulos branches.ts, graphData.ts e graph/.

## 0.57.0

### Minor Changes

- be2e46d: Os dados sintéticos da demo pública passam a incluir o grafo de commits: o `make-demo-data.ts` gera `graph-demo-api.json` e `graph-demo-web.json` no shape do contrato do coletor, com hashes 40-hex determinísticos consistentes com os tips do `branches.json` e os `headRefOid` dos PRs demo, 2-3 merges por repo (junções de lanes visíveis), exatamente uma aresta clipada por repo (pai fora da janela, desenhada com o marcador "continua") e refs nos tips das branches e em tags. O novo script `pnpm demo` gera o fixture completo (8 JSONs) e as docs do grafo deixam de documentar o empty-state como limitação da demo.
- da85d23: As linhas de `stats.perAuthor` ganham o campo opcional `byScope` com os eixos prod/progress (commits, additions, deletions, repos, activeDays, lastCommit, streak e longestStreak do eixo), acumulados pelo coletor na mesma passada do banco e validados por invariantes novos no check-data (soma dos eixos fecha com a linha nos aditivos, teto do eixo nos não-aditivos, union fechada de chaves); o `snapshot:metrics` inclui perAuthor na matriz com a identidade prod+progress==linha por registro. Em `/devs/:name`, com o escopo de trabalho recortado (Produção/Em progresso), os cards históricos — dias ativos, commits/dia ativo, streak e repositórios — passam a ler o eixo correspondente e o sufixo "(total)" deixa de marcar o recorte de escopo (continua marcando o de período). Instalações existentes precisam re-coletar para popular o eixo (`pnpm collect`; a recoleta leve `--reaggregate` também popula, herdando o `scope` gravado no banco); dado antigo sem `byScope` degrada via feature-detect para o comportamento atual (linha integral com "(total)").

### Patch Changes

- bd3f709: `resolveProdRef`/`resolveIntegRefs` agora retornam o candidato que casou (forma resolvível pelo git): em checkout normal onde a ref de produção só existe como `origin/NOME` (sem branch local), o retorno vem na forma longa `refs/remotes/origin/NOME` em vez do nome curto não-resolvível, que fazia os consumidores git falharem (`rev-list` da classificação de escopo e o ahead/behind do inventário de branches). Em clones bare gerenciados (padrão do produto) o nome curto casa primeiro e o retorno segue byte-idêntico. A exibição não muda: `ref_hint` no banco, `productionRef`/`integrationRefs` do branches.json e o hint de /settings continuam com nome curto via helper exportado `displayRefName`.

## 0.56.1

### Patch Changes

- ebf90b9: O comentário de cabeçalho do `.github/workflows/ci.yml` passa a espelhar os gates na ordem real de execução dos steps (`pnpm check:scrub` → `pnpm lint` → `pnpm typecheck` → `pnpm build`), corrigindo a lista defasada que omitia o `check:scrub`, o primeiro gate do job `gates`. Apenas as linhas de comentário do topo foram reescritas — a explicação do job `docs` e a do `check:data` deliberadamente fora do CI foram preservadas, e nenhum step do workflow foi alterado.
- f80f85b: As comparações de percentual fora do `statusOf` passam a usar o `displayPct`, o mesmo helper já aplicado dentro dele (#99/#106): a cor do % de fixes no RepoTable, a contagem de devs em padrão fora do horário no AlertStrip e o filtro do bloco "Atenção" do resumo semanal comparam agora o valor quantizado na precisão do número exibido, então cor e contagens voltam a bater com o que está impresso (ex.: `fixPct` 0,345 imprimia "35%" em âmbar, contradizendo o rodapé "quente = ≥35%"; `offHoursPct` 0,247 aparecia como "25%" `padrão` no painel mas ficava de fora do alerta e do resumo). Nenhum número visível muda.
- 1dbdacc: Labels de contagem nos cards e no resumo semanal agora concordam no singular quando o valor é exatamente 1 ("1 PR aberto", "1 PR parado há 14+ dias", "1 mergeado no período", "1 dev ativo", "1 repo ativo", "1 dia ativo", "1 repositório", "1 aberto agora"), com ternário inline no padrão da casa (decisão da issue #97) em vez de plural fixo.
- b2526ed: Guarda de parse no `defineLoader` compartilhado: sob fallback SPA (dev e preview), um `public/data/*.json` ausente devolve `index.html` com status 200, e o `res.json()` sem guarda vazava um erro críptico de parse JSON para a UI. Agora content-type `text/html` ou falha de parse lança o mesmo erro de um 404 real (`opts.httpError(404)` ou `HTTP 404`), preservando a mensagem fixa que cada loader (stats/github/team/commits/releases/branches) já concatena — arquivo não coletado volta a ser reportado como "arquivo ausente", indistinguível do 404 verdadeiro.
- bba5c92: Corrige as citações restantes da rota antiga `/team` para a canônica `/teams` nos comentários e avisos dos coletores: o cabeçalho do `collect-github.ts`, o aviso de logins sem mapeamento no fim da coleta, o cabeçalho da migração em `lib/legacy.ts` e o cabeçalho do `lib/team.ts`. Mudança apenas de texto, sem efeito de comportamento — o alias `/team` continua existindo para preservar links antigos, e as menções que explicam o alias de propósito (página de times e docs de configuração) ficam como estão.
- 0b86e03: Corrige double-count no burnout.weekendsActive: o campo incrementava +1 por linha de stats.weekly com weekend > 0 na janela das últimas 4 semanas e, como stats.weekly tem uma linha por (semana × repo), o mesmo fim de semana contava várias vezes para o dev que commitou em mais de um repo na semana. A computed burnout agora agrega as semanas ISO únicas por autor com um Set de weekKey e weekendsActive é o tamanho do Set; as somas weekend/night/total continuam aditivas por linha e o número exibido só diminui ou fica igual.

## 0.56.0

### Minor Changes

- 9ae32b1: Chips de **Escopo** na FilterBar (Todos / Produção / Em progresso, `?scope=`): recortam cards, timeline, gráficos e as janelas fixas de ritmo/burnout/fora do horário pelas linhas de `scope` dos agregados (omit-prod), com exceção de `/branches` (a página é por natureza a vista do progresso) e feature-detect de dados pré-#119. Card de commits do dashboard com split **"X • Y" — em produção • em progresso** quando o escopo é Todos (janela do período; o delta usa sempre o mesmo escopo no numerador e no denominador) e linha de histórico com o split de `totals.prodCommits/progressCommits`. Predicados de escopo nas superfícies que iteravam linhas cruas: `/repos/:name` (cards + tipos de commit), perfil do dev (cards, donut, heatmap, timeline de autor e "Últimos commits" via campo `scope` do `commits.json`); rótulos "(total)" quando há recorte de período **ou** de escopo (perAuthor/perRepo/streaks exigem granularidade de dia que só existe no coletor). Rodapés de janelas fixas estendidos: ritmo e burnout "segue o escopo, ignora o período"; cycle time, releases, inatividade, ranking do time e grafo declaram que ignoram o escopo; o resumo semanal declara no slideover que é relatório do time inteiro. Ícone do painel Repositórios alinhado à rail (`i-lucide-folder-git-2`). Limitação conhecida na copy (tooltip dos chips): squash/cherry-pick pode contar o mesmo trabalho duas vezes — hash novo em produção + hash original em progresso. A fachada `data.ts` passa a reexportar `setWorkScope`/`scopeMatches`/`WORK_SCOPES`/`isWorkScope`/`WorkScope` (padrão #41).
- b9676f6: Documentação do eixo de trabalho (produção × progresso) e harness versionado de regressão das agregações. Nova página de guia "Produção vs progresso" para gestores (EN + pt-BR): o que cada escopo mostra, os painéis que seguem/ignoram o `filters.workScope` (janelas fixas — inatividade especialmente) e as limitações conhecidas (dupla contagem do squash, `ref_hint` melhor-esforço, expurgo de fantasmas retroativo). O vocabulário triplo de escopo (`scope` de dados × `filters.workScope` × `FilterScope` de rota) vira tabela no AGENTS.md com as regras operacionais do workScope; o `?scope=` entra nas regras dos filtros (EN + pt-BR), com o grafo de commits na tabela de janelas fixas. `/branches` e o grafo de commits passam a ser referenciados no nav/sidebar do site de docs (páginas órfãs) e entram na lista de features dos dois READMEs. Varredura de contagens stale das ondas anteriores (4→6 coletores; 5→6 JSONs + `graph-*.json` por repo) em maintenance/publishing/development/READMEs. Novo `pnpm snapshot:metrics` (`scripts/snapshot-metrics.ts`): harness de regressão node/tsx puro que injeta o `stats.json` real no store e imprime JSON determinístico (chaves ordenadas, sem timestamp) de 18 cenários de filtros (6 bases × `all|prod|progress`) com a identidade aditiva `prod+progress==all` embutida (violação → exit 1) e `--now=YYYY-MM-DD` opcional para baselines estáveis entre dias — documentado no guia de desenvolvimento (EN + pt-BR).

## 0.55.0

### Minor Changes

- 5c81c4f: Novo coletor `collect-graph`: topologia de commits por repo em `graph-<repo>.json` (UM arquivo por repo) — hash/parents 40-hex completos, autor canônico, data UTC ISO com ms (author date), subject e decoration de refs/tags, COM merges (os conectores do desenho do grafo; não alimenta o banco nem o stats — decisão #7 intacta). Nova chave `GITVIEW_GRAPH_WINDOW` (janela em CONTAGEM de commits por repo, default 1000; valor inválido cai no default com aviso); `check-data` ganha região própria: valida os graph-*.json presentes (40-hex, ordem descendente, sem hash duplicado, repo == nome do arquivo) e repo do stats sem arquivo é aviso, não erro; a recoleta light não roda o coletor e os graph-*.json existentes sobrevivem a ela; `pnpm collect` inclui o passo entre branches e releases (+ `pnpm collect:graph`); docs EN + pt-BR.
- b5ac5c9: Nova seção **Grafo de commits** (`#grafo`) em `/repos/:name`: renderer SVG puro (sem ECharts — o chunk de gráficos não cresce) da janela de commits do `graph-REPO.json`, com lanes calculadas no frontend (`src/graph/lanes.ts`, modo freedp validado no spike #125: junções como o git desenha, sem lanes zumbis, ≤ 19 colunas no pior window real). Windowing vertical (render inicial ~40 linhas medido < 100 ms no build real + "Mostrar mais antigos" de 300 em 300), arestas verticais fundidas em runs, parent fora da janela como aresta tracejada com marcador "continua", cores de lane por matiz (PALETTE reordenada no dark / tons 600 no light, contraste ≥ 3,09:1), tooltip com assunto/autor canônico/data/refs/hash, linha inteira linkada ao commit no GitHub via `repoUrls`, chips de refs da janela com destaque de lane (hover/fixar) e empty-state "rode pnpm collect". Janela fixa intencional: o grafo NÃO segue os filtros de período/bots (remover commits quebraria as cadeias de merge) — o rodapé rotula a janela e a exceção; sub "Grafo" na navegação de Repos; tipos `GraphData`/`GraphCommit` em `types.ts`; docs EN + pt-BR em `dashboard/graph.md`.

## 0.54.0

### Minor Changes

- 359db4c: Nova página `/branches` (rail entre PRs e Repos): inventário do `branches.json` com três cards de alerta (Pousadas — podem ser limpas; Abandonadas — trabalho não liberado parado; develop × produção por repo), tabela ordenável (branch, repo, status, ahead/behind produção e integração, última atividade, autores à frente, PR, link GitHub) e join branch↔PR via `headRef`/`headRefOid` do `github.json` — status derivados no frontend (`viva-sem-PR`, `pousada-via-squash`), badge de cobertura parcial quando o cache de PRs é antigo ("sem vínculo", nunca "sem PR"), badge de frescor do inventário e mapeamento e-mail→dev via `team.json`. Repos troca de ícone na rail (`i-lucide-folder-git-2`); docs EN + pt-BR em `dashboard/branches.md`.

## 0.53.0

### Minor Changes

- 5c894c6: Novo coletor `collect-branches`: inventário de branches por repo no 6º JSON (`branches.json`) — status (production, integration, feature, bot, pousada), ahead/behind SEM merges vs produção e vs a primeira ref de integração, autores à frente com e-mail cru do git (%ae) e linhas +/−. Novas chaves `GITVIEW_BRANCH_STALE_DAYS` (default 30) e `GITVIEW_BOT_BRANCHES`; o `check-data` valida o novo JSON (invariantes + avisos); a recoleta light não toca o `branches.json` (frescor atrelado ao fetch do full); a demo sintetiza branches coerentes com os PRs fictícios.
- 2eb9876: Expurgo de commits inalcançáveis em clones gerenciados: após o fetch --prune e a classificação de escopo, o coletor apaga do banco os commits que não estão mais alcançáveis por nenhuma ref do repo (`git rev-list --all`) — os fantasmas de branches squash-mergeadas e apagadas no remote, que o `INSERT OR IGNORE` nunca expurgava e inflavam o 'Tudo' para sempre. Aplica somente aos clones gerenciados (`data/repos`), recém-atualizados pelo fetch; checkouts normais nunca são expurgados. Efeito retroativo: totais históricos podem diminuir sem fato novo, e o log do coletor é o único rastro.
- d541dc5: Novo filtro de escopo de trabalho no núcleo dos filtros — `filters.workScope` (`all` | `prod` | `progress`, default `all`), com a ação nomeada `setWorkScope` (porta única de escrita) e o predicado único `scopeMatches(row)` na codificação omit-prod dos dados (linha sem `scope` = produção; `progress` agrupa integration + branch). O predicado vale nas 4 projeções filtradas (weekly/monthly/heatmap/types) e nos 3 iteradores diretos de `previousTotals`, `pace` e `burnout` — as derivadas (totais, contagens, commits por autor/repo, fora do horário) herdam das projeções. O estado sincroniza com a URL via `?scope=` (enum fechado; valor inválido cai em `all`; default omitido), persiste em localStorage (`gitview:scope`), reseta no voltar/avançar sem arrastar contexto de outra entrada e é forçado a `all` em dados anteriores à divisão prod/progress (feature-detect de `totals.prodCommits`). Os iteradores de página e a UI (chips/cards/rodapés) vêm na próxima issue.

### Patch Changes

- 25f1439: P0: clones gerenciados congelados no tempo. `git clone --bare` não grava `remote.origin.fetch` (o git só grava refspec em clone normal), então o `git fetch --all --prune --tags` de cada coleta só escrevia `FETCH_HEAD`: `refs/heads/*` não avançava nem era podado — commits novos nunca entravam no banco (o dashboard apodrecia em silêncio) e o expurgo de refs mortos jamais disparava. O `cloneBare` agora grava o refspec `+refs/heads/*:refs/heads/*` na criação (`git config` pós-clone — `--config` no comando clone foi medido e falha com "multiple updates for ref not allowed" num bare) e o `fetchRepo` faz backfill idempotente nos clones existentes antes do fetch: o primeiro collect pós-fix se auto-cura (para um buraco longo de congelamento, um `--full` único fecha qualquer edge de committer-date antiga). `denyPush` (pushurl=no-push) preservado e o token segue só via env do processo.

## 0.52.0

### Minor Changes

- 99e01ca: PRs coletados agora trazem o vínculo PR↔branch: `headRef`, `baseRef` e `headRefOid` no `github.json` (nomes das branches head/base e SHA do head no momento da coleta). O vínculo sobrevive ao auto-delete da branch em PRs mergeados. Os campos são opcionais: linhas preservadas de caches anteriores continuam sem eles até um `pnpm clean && pnpm collect` completo, que preenche os refs dos PRs históricos. UI trata ref ausente como vínculo desconhecido (cobertura parcial), nunca como PR inexistente.
- d521b24: Escopo de ref (prod/integration/branch) nos dados exportados: as chaves de agregação de weekly/monthly/heatmap/monthlyTypes incluem o scope do banco e o JSON usa codificação omit-prod (campo `scope` só quando 'integration' ou 'branch'; ausente = produção). `totals` e `perRepo` ganham `prodCommits`/`progressCommits` e a amostra de commits.json viaja com o mesmo encoding. O check-data valida a union fechada do campo e novos invariantes de erro (prod + progresso = total; partição do monthly por presença de scope), com aviso não bloqueante de repo com commits e nenhum em produção; o collect avisa sobre linhas não classificadas (scope NULL, fora de todas as métricas) e commits branch sem ref_hint. A demo sintetiza linhas de progresso coerentes.

## 0.51.0

### Minor Changes

- 545346e: O coletor grava o escopo de ref de cada commit no data/gitview.db: colunas novas scope ('prod' = alcançável da ref de produção; 'integration' = alcançável das refs de integração e não de prod; 'branch' = demais) e ref_hint (nome curto do primeiro ref alcançável, melhor esforço; NULL para alcançável só por tag), com migração in-place idempotente do banco existente — sem necessidade de clean && collect. A classificação roda em todo collect com git via sets completos de git rev-list (consome o seam de refs de scripts/lib/refs.ts) e atualiza só as linhas que mudaram: commit de branch mergeada vira prod sem --full. O --reaggregate segue sem git e, havendo linhas com scope NULL, avisa para rodar pnpm collect sem emitir contagens por escopo. O shape dos JSONs exportados não muda.
- f10f2b6: Novo card "Refs dos repositórios" em Configurações → Geral: edita GITVIEW_PRODUCTION_REF e GITVIEW_INTEGRATION_REFS pela UI (grava no .env linha a linha, preservando comentários e ordem) e mostra um hint somente-leitura com o valor resolvido por repo — o que a coleta vai usar de fato, incluindo o fallback da detecção automática (origin/HEAD → HEAD → main → master) quando a ref explícita não existe no clone. A resolução roda no dev server (endpoint de status estendido com ?refs=1, com cache por processo); ref inexistente não quebra nada — a coleta segue caindo no fallback por repo com aviso.

## 0.50.0

### Minor Changes

- 584cc2d: Novo seam de refs de produção/integração em scripts/lib/refs.ts, testável por probe e ainda sem consumidores: resolveProdRef (valor explícito da config se existir no repo, senão origin/HEAD → HEAD → main → master, com aviso nomeando o repo no fallback; nada resolvível é erro, nunca vazio silencioso) e resolveIntegRefs (lista da config filtrada por existência no repo, default develop,staging; lista vazia é legítima). Chaves novas GITVIEW_PRODUCTION_REF e GITVIEW_INTEGRATION_REFS no ENV_KEYS, .env.example e docs (EN + pt-BR).

## 0.49.16

### Patch Changes

- 2ee31fa: Nav das docs em 4 itens: tour do dashboard entra no Guia; Configuração vira Referência (config + regras de filtro + glossário).

## 0.49.15

### Patch Changes

- a369ad9: Header das docs com 5 itens: página de publicação vira parte do Guia; dropdown Contribuição agrupa Arquitetura e contribuição.

## 0.49.14

### Patch Changes

- ec9eb9a: Revisão editorial completa das documentações (EN + pt-BR): tom direto, slogan novo, sem conteúdo de migração/legado.

## 0.49.13

### Patch Changes

- b2de036: Capturas da doc regeneradas do fixture sintético pós-leva housekeeping: prs.png agora mostra o card 'mergeados sem review · 1 PR' (a forma antiga renderizava o bug '1 PRs') e health.png traz o rodapé '3+ dos últimos 4 fins de semana ativos'. overview.png e dev.png saíram byte-idênticos.

## 0.49.12

### Patch Changes

- d56baf1: AGENTS.md: forma canônica do `git log` com `--no-renames` e `data.ts` descrito como fachada (issue #41); docs de arquitetura alinhadas à forma do código
- 58e0237: Corrige apenas comentários defasados (zero mudança de comportamento): o cabeçalho de `scripts/collect-plugin.ts` passa a descrever os quatro coletores em sequência, mais a verificação final (check-data), e o modo leve; `.env.example` e o cabeçalho de `scripts/lib/config.ts` passam a citar a rota canônica `/teams`.
- 390240c: docs: o par CONTRIBUTING espelha os 4 gates do `ci.yml` na ordem do workflow (`check:scrub`, `lint`, `typecheck`, `build`) — a frase sobre o CI omitia `check:scrub`, e o bloco de gates locais passa a listá-lo. O `check:data` continua fora do CI de propósito: valida `public/data/`, que só existe após coleta local.
- 2846edb: Rodapé do card "Fora do horário" descreve "3+ dos últimos 4 fins de semana ativos" — a copy agora diz o que `weekendsActive` realmente calcula (colunas de fim de semana com commit nas últimas 4 semanas da janela fixa de 8, sem exigir sequência); só texto, zero mudança de comportamento (issue #100).
- d785d98: Guarda de plural nos 6 sites "N PRs" que mostravam "1 PRs": PrSummaryCards (merge sem review), summary exportável, ReviewCoverage ("PR/PRs mergeado(s)" conforme o total), PrCycleTime (tooltip por repo), TeamCard e TeamCandidatesSection. Ternário inline no padrão da casa — sem helper novo.
- e68e62c: badge do RiskBar compara o pct quantizado que ele exibe (ex.: 0,247 mostrava 25% com selo "atenção"; agora resolve o tier pelo 25% impresso). Regra num único ponto: os 5 painéis de saúde herdam via `statusOf`.

## 0.49.11

### Patch Changes

- e537e36: docs: :::warning com o aviso no corpo (não no título) e a folga de 1 dia do gate `MERGED` descrita na página de coletores — par EN/pt-BR.
  
  Ref: #101

## 0.49.10

### Patch Changes

- 6ee2afb: docs: quatro capturas da demo (dados sintéticos) na doc e no README + `pnpm demo:shots` para regenerá-las com Chrome headless, recusando capture de dados reais.
  
  Ref: #96

## 0.49.9

### Patch Changes

- 1039ce1: CI + deploy do site de docs (issue #73): novo job `docs` na CI roda `check:docs` (gate de paridade EN ↔ pt-BR em `scripts/check-docs.ts`) e `docs:build` como gate de links; o deploy do Pages publica demo e docs no MESMO artefato — docs sob `<base_path>/docs/`.
  
  Ref: #73
- e8b17f2: Polish do site de docs: SEO/OG absolutos no build (og:image/twitter:card no head raiz, og:locale por locale, og:url/canonical/og:title/og:description/twitter:title/twitter:description por página via transformHead, sitemap.xml com hreflang EN↔pt-BR) + imagem OG 1200×630 derivada da marca; labels de nav/sidebar harmonizados com os títulos reais das páginas nos dois idiomas; seção Documentação no par CONTRIBUTING (par de idiomas na mesma mudança, regra anti-rot, comandos `docs:*` e citação do gate `check:docs` do PR irmão #73); `/__auth/*` incluído nas listas de endpoints de escrita após auditoria claim-vs-código das 38 páginas.
  
  Ref: #74

## 0.49.8

### Patch Changes

- f409d69: Documentação: seção Arquitetura publicada (pipeline, coletores e modelo de dados) em EN e pt-BR, com claims conferidos contra os scripts e as fixtures de dados.
  
  Ref: #77
- 6bfcce5: Conteúdo da seção Configuração do site: env, team.local.json e manutenção dos dados (+ espelhos pt-BR).
  
  Ref: #76
- 26b8a9b: Glossário de métricas do dashboard no site de docs (EN + espelho pt-BR): as fórmulas, janelas e thresholds dos 8 grupos de métricas conferidos contra os coletores e o `src/`.
  
  Ref: #81
- eb81991: Conteúdo real da seção Dashboard do site de docs: tour página a página do dashboard e as regras dos filtros, nos dois idiomas, com painéis, labels, rotas e janelas fixas conferidos contra o código em src/.
  
  Ref: #80
- 388461e: Docs da seção Primeiros passos: 5 páginas em EN + 5 espelhos pt-BR publicados no site VitePress, com claims conferidos contra o código.
  
  Ref: #75
- d2b7e0d: Conteúdo real da home e do FAQ do site de docs (hero, 6 features, Como funciona e as 10 perguntas nos dois idiomas).
  
  Ref: #79
- cd63c3a: docs: conteúdo das seções Publicando e Contribuindo do site (static-deploy, development, release + espelhos pt-BR). Ref: #78

## 0.49.7

### Patch Changes

- 004f565: docs: scaffold do site de documentação com VitePress 2 (alpha.20) — pacote `docs/` no workspace, locales EN + pt-BR (19 páginas cada, nav/sidebar/busca local espelhadas), tema estendendo o DefaultTheme com os tokens visuais do app (azul Nuxt UI, Segoe UI, radius 10px, hover-lift dos stat-cards), logo/favicon SVG novos e scripts `docs:dev`/`docs:build`/`docs:preview` na raiz. Conteúdo das páginas internas é stub (milestone docs).
  
  Ref: #72

## 0.49.6

### Patch Changes

- 0d43790: docs(readme): add a rot-resistant "Project status" section (no versions, no issue numbers) and mention the MIT license in both READMEs

## 0.49.5

### Patch Changes

- 3792826: fix(tooling): pin LF for src/route-map.d.ts via .gitattributes to stop the phantom modified state after build on Windows

## 0.49.4

### Patch Changes

- c835bfc: fix(filters): convert weekly period keys to their Monday's month key before the month-cutoff comparison in inPeriodMonth

## 0.49.3

### Patch Changes

- 85d33b6: chore(collect-team): dedup de renamedFrom por chave NFC
  
  O `team.json` agora deduplica `renamedFrom` por chave `n.normalize('NFC').toLowerCase()`
  em vez de por string bruta: o mesmo nome antigo digitado em macOS (NFD) e em outro
  sistema (NFC) sobrevivia como DUAS entradas no JSON. Passa a sobrar só a primeira
  forma bruta de cada chave (a forma crua é preservada; o que se normaliza é a
  comparação), mantendo o descarte quando a chave equivale ao nome atual do time.
- 3215d28: fix(WeeklyChampions): baseline das 8 semanas anteriores filtra pelo período
  
  A janela de baseline do campeão da semana agora só considera as semanas
  ISO anteriores que caem DENTRO do período filtrado (`inPeriodMonth`).
  Antes, semanas anteriores ao início do período contavam como 0, a média
  defluía e a razão inflava: no preset 1M a primeira semana do período
  aparecia com 116× (baseline 0 → razão = commits puros, volume puro — o
  que a issue #10 queria evitar). Semana sem nenhuma semana anterior no
  período fica de fora do ranking (sem campeão naquela semana). Com
  "Tudo" (sem filtro) `inPeriodMonth` é sempre true — comportamento idêntico
  ao atual. Comentário do bloco e rodapé atualizados para refletir a regra.

## 0.49.2

### Patch Changes

- 1eb8887: fix(WeeklySummary): fallback de cópia do markdown fora de contexto seguro
  
  O botão "copiar markdown" agora tenta primeiro a Clipboard API e, se ela
  não existir (http na LAN) ou rejeitar, copia via textarea temporária com
  `document.execCommand('copy')`. Sucesso pelo fallback mostra o mesmo
  feedback do caminho normal ("copiado!" + toast de sucesso); só quando
  ambos os caminhos falham aparece o toast de erro. O botão fica
  desabilitado apenas quando nenhum caminho de cópia existe.
- 7a6943d: fix(AppNav): estabilizar o posicionamento do botão de reabrir o painel
  
  A div raiz do AppNav agora tem `relative`, tornando-a o containing block
  do botão flutuante 'mostrar painel' (que usa `absolute`). Antes, o
  posicionamento dependia de um ancestor externo (o shell sem `relative` em
  _parent.vue) e o botão pulava de lugar se algum wrapper ganhasse
  `position`. Comportamento visual inalterado.

## 0.49.1

### Patch Changes

- docs(conventions): regra de copy de feedback (toasts com título em inicial maiúscula + useConfirm para ações destrutivas) no AGENTS.md.

## 0.49.0

### Minor Changes

- 1e4e430: refactor(types): union fechadas e envelopes tipados — `MergedPr` (`PullRequest & { mergedAt: string }` + `isMergedPr`) nos computeds de PRs mergeados eliminando os `!` de `mergedAt` (github.ts, summary.ts, repos/[name], DevStatCards); `PrReview.state` com union fechada (`PrReviewState`, valores do enum `PullRequestReviewState`) validada no check-data; envelopes `SseLine`/`SseStep`/`SseError` tipados em `sse.ts` com parse em try/catch (payload malformado nunca lança dentro do handler); `FilterScope` exportado só de `router/meta.ts` (antes 3×); `DETAIL_ROUTES` tipado como `Set<RouteName>` contra o `route-map.d.ts` gerado (typo de rota quebra o typecheck); helper `getOrCreate(map, key, init)` no lugar do padrão `map.get(k)!` em src e scripts — zero non-null assertions restantes no projeto (templates pré-compostos em CycleTrend/DevCommitsTable/PaceAlert, que ficam fora do typecheck)

## 0.48.0

### Minor Changes

- 3078d18: refactor(data): split do data.ts em filters/date/aggregations com reexports, agregações comuns (`groupBySum`/`nestBySum`, `commitsByRepoPeriod`, `commitsByAuthorWeek`, `fixByRepo`) que eliminam as varreduras repetidas de filteredMonthly/filteredWeekly nos componentes, e decomposição de devs/[name] (CommitsTimeline com prop `author`, `useDevCharts`, DevStatCards/DevPrOpen/DevCommitsTable) com blocos compartilhados (StatCards/DetailHeader) extraídos junto com repos/[name]. Comportamento e números inalterados.

## 0.47.0

### Minor Changes

- d509f7f: refactor(charts): unifica `donutBase()`, `RiskBar.vue` + `statusOf()`, `PrLinkCell.vue` e `COMMIT_TYPES`/`commitTypeColor()` — as configs de donut (3 cópias), o padrão "risk bar" (5 cópias), a célula de link de PR (3 cópias) e as categorias/cores de commit (2 cópias) tinham uma só implementação cada. `ChartPanel` ganha empty state para gráfico sem dados e exporta PNG via ref do `VChart` (sem seletor de atributo interno do ECharts), com toast de sucesso/falha. `oklchToHex` cobre `none`/unidades de matiz/alpha e devolve fallback hex (nunca vaza `oklch(` cru), com `resetThemeCache()` documentado e helpers tipados com os tipos ECharts.

## 0.46.0

### Minor Changes

- e96e7e4: feat(ui): UFormField nos inputs, emojis → UIcon lucide, useConfirm (UModal) unificado nas confirmações destrutivas, toasts em toda ação e title nativo → UTooltip
- f85b7d8: refactor(charts): `useHeatmapMatrix` (composable em `src/charts/`) unifica a agregação em Map de chave composta → dados `[x, y, v]` → tooltip formatter → visualMap com `Math.max(max, 1)` → série heatmap dos 4 heatmaps (ActivityHeatmap, AuthorMonthHeatmap, RepoMonthHeatmap e o bloco de horários do perfil do dev), com `rows`/`xKey`/`yKey`/`ramp`/`order`/`formatTip`; `WEEKDAYS` vira constante canônica e `useWeekdayHourHeatmap` cobre os dois heatmaps dia-da-semana × hora. Visual dos 4 heatmaps preservado, incluindo o visualMap escondido do perfil do dev (agora parâmetro explícito e documentado)

## 0.45.0

### Minor Changes

- 0b67f37: refactor(ui): `TablePanel` (wrapper de tabela com `ui` fixo) e `StatCard` + `.cards-grid` global unificam os wrappers/stat-cards copiados (RepoTable, PrOpenTable, DevTable, BusFactor, InactiveWatch, devs/[name], repos/[name], SummaryCards, PrSummaryCards) com grid/typo unificados, e `lastTagLabel(repo)` em `releases.ts` passa a ser o campo canônico (`tag`) da última release — tabela de repos e grade de releases mostram a mesma string
- 4995030: refactor(teams): quebra do teams.vue em useTeamDrafts, modais, seção de candidatos e barra de gravação — identidade de time por cid em tudo (sem resolução por índice), toTeamDraft() único em src/team.ts, TeamCard com defineModel/emits tipados (sem mutação de props), métricas/opções por cid em computeds cacheados, payload do GitHub em shallowRef e um só onMounted na página

## 0.44.0

### Minor Changes

- a38a955: refactor(stores): shallowRef + markRaw nos payloads dos loaders (stats/github/releases/team), predicados de filtro únicos em `src/filters-core.ts` (`cutoff`/`repoSelected`/`authorSelected` + janelas `inPeriodMonth`/`inPeriodDay`) e ações nomeadas em `data.ts` (`setRange`/`toggleRepo`/`lockAuthors`/`resetSelection`...) no lugar das mutações diretas de `filters` pelos componentes

### Patch Changes

- 1e9abfe: fix(a11y): navegação por teclado nas tabelas, aria-labels/pressed/sort e aria-live — DevTable/RepoTable com link real na 1ª célula e ordenação por botão (aria-sort + chevron), aria-label nos botões só-ícone do FilterBar e nos itens da rail, aria-pressed nos chips de seleção, tooltip de aliases focável no DevCard, RunLog/splash com role=status e chips de membros como links

## 0.43.0

### Minor Changes

- 02e62c0: refactor(format): unifica os formatadores do frontend em `src/format.ts` (issue #32). A formatação vivia espalhada em 10+ arquivos com nomes colidentes e comportamentos divergentes (`fmt` com 4 comportamentos, `fmtDate` com 6 assinaturas, diferença de dias copiada em 6+ lugares, `median`/`fmtDuration` presos em `github.ts`); agora existe um módulo único:
  
  - `fmtInt` (milhar pt-BR) · `fmtCompact` (2,2M / 350k — vírgula decimal) · `fmtRatio` (1 casa decimal com vírgula; sufixos `×`, `/sem`, `/mês` ficam no chamador) · `fmtDuration` (horas → <1h/h/d/sem) · `fmtDate` (dd/mm/aaaa; "—" sem data) · `fmtDay` (dd/mm) · `fmtDateTime` (data + hora) · `fmtDaysAgo` (hoje/ontem/há Nd) · `daysSince` · `median`
  - `median` e `fmtDuration` saem de `github.ts` (reexportados lá como compat) e todos os consumidores importam de `src/format.ts`
  - separador decimal unificado: `toFixed(1)` com ponto vira vírgula pt-BR em PaceAlert (`média N,N/sem`), DevTable e `/devs/:name` (`commits/dia ativo` — o CSV do DevTable segue com ponto decimal, parseável) e RepoReleasesGrid (`cadência/mês`)
  - constantes nomeadas novas em `src/thresholds.ts`: `PR_AGE_AMBER`/`PR_AGE_RED` (bandas de idade do PrOpenTable) e `DELTA_FLAT_PCT` (delta flat do SummaryCards)
  - normalização mínima de comportamento: o eixo do LinesFlow passa a compactar a partir de 10k (mesmo limiar dos cards; antes 1k arredondava 2.500 → "3k") e o timestamp de commits em `/devs/:name` ganha os segundos do `toLocaleString` padrão (antes montado à mão sem segundos)
- 27f2a65: refactor(loaders): infra única de fetch dos JSONs (`defineLoader`), consumo de SSE (`useSseProgress`) e helpers HTTP (`src/api.ts`) — issue #34

## 0.42.10

### Patch Changes

- cc7b7fa: fix(alerts): centraliza os limiares de negócio em `src/thresholds.ts` e unifica valores divergentes entre painéis (issue #26). Os mesmos conceitos tinham números diferentes em componentes que deveriam mostrar a mesma métrica; agora tudo importa as constantes nomeadas do módulo único (rótulos de UI interpolam as constantes):
  
  - `PACE_FALLING = 0.5` — o alerta da Visão geral (AlertStrip) sai de 0.6 e passa a usar o mesmo limiar do painel Ritmo (PaceAlert, que prevalece)
  - `PR_STALE_DAYS = 14` — o card do PrSummaryCards migra de 7d para a janela de 14d (mesmo critério de `>=` do `stalePrs`, do PrStaleAlert e do resumo semanal)
  - `MERGE_NO_REVIEW_RED = 0.2` / `MERGE_NO_REVIEW_AMBER = 0.1` — o card "mergeados sem review" do PrSummaryCards troca o erro em >50% pela escala 20%/10% do ReviewCoverage
  - `DEV_STALE_DAYS = 21` + filtro `!isBot()` no AlertStrip — o alerta de inatividade passa a contar só devs (igual ao InactiveWatch) e bate com a lista do /health
  - demais limiares viram constantes importadas sem mudança de comportamento: fix hotspot 35%/25% (+ amostra mínima 20), commits não liberados 20/50, off-hours 25%/3 fds (com bandas de atenção 15%/5 e mínimos de commits do período e da semana), inatividade de repo 30d (bandas de erro 60d/90d) e release atrasada 30d
- 507fe08: fix(ui): bugs de apresentação (#29) — separador decimal pt-BR unificado (vírgula) nos formatadores compactos (SummaryCards, devs/[name], repos/[name]), delta flat dos cards mostra o pct real em vez de "0%", tooltip do delta com concordância correta via UTooltip ("vs o mês anterior" no 1M), nome do PNG exportado normaliza acentos (NFD) antes de sanitizar, `Date.now()` do "dias aberto" sai do template (helper `daysOpen`) e o `setTimeout` do "copiado!" no WeeklySummary é limpo no unmount.

## 0.42.9

### Patch Changes

- 9cd6f10: fix(setup): polling do device flow não sobrevive mais ao unmount (limpeza completa + AbortController), `disconnectGithub` trata erro com feedback na UI e link do device flow ganha `rel="noopener noreferrer"`.
- cbadf80: fix(setup): RepoPicker — descarta resposta atrasada de org anterior ao trocar de organização (race de listagem), preserva a seleção manual quando o status chega/atualiza, permite aplicar com zero repositórios marcados no modo manage (remoção total) e pede confirmação em modal listando os clones que serão apagados do disco antes de aplicar
- 1532114: fix(teams): :key duplicado nos badges, dirty sensível à ordem de chaves e cor hex inválida aceita
  
  - badges de e-mails/logins no editor de perfil renderizam a lista deduplicada (Set sobre o split) e o `confirmEdit` normaliza as listas, impedindo duplicatas de persistir no `team.local.json`
  - `dirty` passa a comparar os snapshots com serialização estável (chaves de objeto ordenadas), eliminando o aviso de "alterações não salvas" fantasma sem mudança real
  - cor hex custom do TeamCard restrita a 3/6/8 dígitos (`#rgb`, `#rrggbb`, `#rrggbbaa`) com mensagem de erro visível no campo (`use #rgb, #rrggbb ou #rrggbbaa`) em vez de descartar hex inválido em silêncio
- bcd5378: fix(tables): CSV do DevTable agora escapa campos no padrão RFC 4180 (aspas duplas com `;` como separador — nomes de dev com `;`, aspas ou quebra de linha reimportam íntegros), unifica `commits/dia ativo` numa fonte única `commitsPerDay` usada pela tabela e pelo CSV (1 casa decimal, antes `toFixed(2)` no CSV vs `toFixed(1)` na tela) e passa a exportar `ultimo_commit` com o mesmo `fmtDate` (fuso local) do template — antes o `slice(0, 10)` do ISO era UTC e podia divergir em 1 dia do valor exibido (mesmo critério aplicado ao nome do arquivo). A regra CSS morta `.dev-row.selected` ganha a classe `:class="{ selected: ... }"` faltante, destacando as linhas cujo dev está no filtro global (`filters.authors`). No mesmo saneamento, remove o CSS morto `.app-title` de `src/main.css` (o `<h1 class="app-title">` sumiu na refatoração two-pane e a regra ficou órfã — sem elemento para reaplicar, o correto é remover).

## 0.42.8

### Patch Changes

- b12d5a0: Endurece o gate `pnpm check:scrub` nas duas arestas de fail-open apontadas na revisão independente do batch: `git ls-files -z` (nomes crus, sem quoting — path com espaço nas pontas ou não-ASCII não vira "outro arquivo" e não escapa do scan pelo catch) e `console.warn` em leitura que falhar, em vez de `continue` silencioso. `maxBuffer` explicitado (32 MiB) para o limite padrão de 1 MB do `execSync` não estourar silenciosamente em repo grande. Validado nos dois sentidos: 121 arquivos limpos / termo injetado em arquivo tracked → exit 1 com arquivo:linha e termo.
- c747db0: Corrige o gate `pnpm check:scrub` se auto-flagando: os rótulos literais das tuplas de `TERMS` em `scripts/check-scrub.ts` contiam os próprios termos de identidade (só a regex era montada por fragmento), então o gate saía com exit 1 em qualquer árvore limpa — quebraria o CI em todo push. Rótulo agora também é montado por fragmento; validado nos dois sentidos (árvore limpa → 119 arquivos ok; linha injetada em arquivo tracked → exit 1 com arquivo:linha e termo).
- 6c397fe: Inclui `pnpm check:scrub` na seção de comandos do par `README.md`/`README.pt-BR.md` — o gate entrou no CI neste batch e faltava na lista de comandos dos dois idiomas (par mantido seção a seção, alinhamento de coluna idêntico ao resto do bloco).
- 31bb61b: Corrige o botão "salvar" de `/teams`: `@click="save"` repassava o `MouseEvent` nativo para dentro do novo parâmetro `save(skipRefresh)` (o UButton chama `onClick(event)`), então o salvar simples enviava `skipRefresh: true` — o POST pulava a regeneração do `team.json` (chips da sidebar e `/teams/:name` ficavam defasados até uma recoleta manual) e o toast mostrava o texto da recoleta leve. Vira `@click="save()"`.

## 0.42.7

### Patch Changes

- fb2efda: Migra `grid.containLabel` para o API do ECharts 6 nos 4 gráficos afetados (CommitTypes, PrCycleTime, PrReviews e "Commits por dev" de /repos/:name): `outerBoundsMode: 'same'` + `outerBoundsContain: 'axisLabel'`, o equivalente oficial documentado — mesma projeção de layout de antes, sem o aviso `LegacyGridContainLabel` no console.
- 19eaa41: Corrige o aviso `VUE_ROUTER_R0121` do vue-router no console: `src/urlState.ts` passou a chamar `history.replaceState(history.state, …)` nas duas reescritas de URL (watch de filtros e `afterEach`) em vez de `null`, preservando os metadados internos do router (localização anterior e `scrollPositions`) usados em voltar/avançar.

## 0.42.6

### Patch Changes

- 0da9960: fix: follow-ups da revisão pré-push — baseline do WeeklyChampions em semanas calendário (vazia conta 0), save de /teams alinha draft por construção (não por nome), POST /__team/config aceita skipRefresh, collect-team filtra renamedFrom não-string e compara NFC, matchesGlob escapa '?' e cacheia a regex por padrão

## 0.42.5

### Patch Changes

- 73e203a: ci: gate anti-regressão do scrub de identidade (check:scrub, roda no CI) + bump do pin packageManager para pnpm 11.28.6

## 0.42.4

### Patch Changes

- e17f2ff: ci(demo): rebuild mensal agendado do Pages — o fixture ancora as datas em "hoje" no build, então sem pushes a demo envelhecia fora dos presets curtos

## 0.42.3

### Patch Changes

- d50b799: fix(deps): override de katex para ^0.18.2 (advisory; cadeia dev-only via @eslint/markdown) — encerra os runs do Dependabot falhando com security_update_not_possible

## 0.42.2

### Patch Changes

- 9831a46: docs: `ROADMAP.md` como índice fino — aponta para issues/milestones (o tracking autoritativo) e se recusa a duplicar checklist/status/regras, para não apodrecer; lote de higiene agrupado no milestone `housekeeping` (#12/#17/#20/#21)

## 0.42.1

### Patch Changes

- f75fb7c: fix(demo): `isoWeekKey` do gerador de fixture dividia por `7 * 876e5` em vez de `7 * 864e5` (typo achado na revisão independente) — as semanas ISO dos buckets semanais corriam ~1% por semana e embaralhavam semanas ≥38; agora espelha o `isoWeekKeyOf` do collect.ts (validado: 13 buckets, 0 divergentes vs as datas dos commits). Também: sort de commits com desempate por hash, remoção de `void lastT` morto e comentário documentando que o fixture ancora em "hoje" (UTC) de propósito

## 0.42.0

### Minor Changes

- 71d5286: feat(oss): demo pública no GitHub Pages com fixture sintético — `scripts/make-demo-data.ts` gera devs "Ana"/"Beto" e commits fictícios (com guarda: recusa sobrescrever `public/data/` existente sem `--force`) e o workflow `pages.yml` roda fixture → `check:data` → build com a base do Pages → `404.html` (fallback de SPA) → deploy, com actions pinadas por SHA; router e os 5 loaders de dados passam a respeitar `import.meta.env.BASE_URL` (deep links funcionam sob subpath); scrub final de identidade nos arquivos versionados (exemplos do collect-team.ts e urlState.ts)

## 0.41.4

### Patch Changes

- 5ff436d: fix(ci): policy `minimumReleaseAge: 1440` pinada no `pnpm-workspace.yaml` (determinismo: o config global de máquina podia zerar e o CI divergia — primeiro push de main falhou no `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`) + `eslint` volta pro piso `^10.12.0` e lockfile regenerado sob a policy (só versões maduras); CONTRIBUTING par documenta o comportamento esperado para bumps recentes

## 0.41.3

### Patch Changes

- e7f5ed2: fix(oss): achados da revisão pré-push — actions do CI pinadas por SHA (supply chain, versão no comentário), comentário do CI diz 22.13 (o piso real do node:sqlite sem flag) e a claim do corepack nos docs vira instrução precisa (`corepack enable` ou instalar o pnpm 11.28 direto) nos 4 arquivos do par README/CONTRIBUTING

## 0.41.2

### Patch Changes

- dd39dbe: docs: CONTRIBUTING.md primário em inglês com espelho CONTRIBUTING.pt-BR.md seção a seção (setup, gates, ritual de changeset/release com `Ref: #N`, convenções de commit com o porquê do pt-BR, regra dos pares de docs, reportar bugs, arquitetura); par de READMEs perde o "currently pt-BR", ganha o link pro guia e correção de claims de requisitos (Node 22.13+ / pnpm 11.28 pinado — antes dizia Node 24+/pnpm 10+, inconsistente com o CI node 22)

## 0.41.1

### Patch Changes

- 2991d10: ci: portões da org (pnpm lint + pnpm typecheck + pnpm build) no GitHub Actions em PR e push em main — workflow `ci.yml` (pnpm do `packageManager`, node 22, cache pnpm; `check:data` fora de propósito porque valida dados locais) + badge de status no topo do par de READMEs

## 0.41.0

### Minor Changes

- 2d214d0: feat(oss): aceite de fresh-clone — `packageManager` pinado (`pnpm@11.28.2`, corepack) e scrub de referências ao empregador em arquivos versionados (eslint.config.js, AGENTS.md, CONTRIBUTING.md, README par, .env.example, exemplo de query em src/urlState.ts)

## 0.40.3

### Patch Changes

- 2b63a67: fix(teams): redirect de nome antigo funciona também com team.json quente (watch do `former` agora com `immediate: true` — antes a página ficava presa no skeleton ao navegar internamente para `/teams/<nome-antigo>` logo após renomear+salvar); matching de nomes normaliza NFC (config NFD do macOS não cai mais em "não encontrado"); POST /__team/config tem timeout de 45s por script-filho (um collect pendurado não trava mais o request); collect-team ignora `renamedFrom` que não seja lista (config editado à mão não gera entradas por caractere)

## 0.40.2

### Patch Changes

- 7a11efc: fix(teams): salvar na tela /teams regenera o team.json na hora (collect-team + check-data no POST /__team/config) e a UI recarrega — nomes/cores/membros passam a valer imediatamente nos chips da sidebar e no dashboard /teams/<nome> (renames registram renamedFrom no save, sem precisar de recoleta); aliases de identidade seguem pedindo "salvar + recoletar" (continuam no stats.json)

## 0.40.1

### Patch Changes

- c2fd96f: fix: triagem dos follow-ups da revisão pré-push (#11) — paleta de time unificada em TEAM_PALETTE (@/team), TeamDraft único exportado, chaves de agregação do collect.ts com separador \u0001 (nomes com '|' não deslocam mais campos), matchesGlob sem placeholder de espaço e case-sensitive como gitignore, ghRetry trata 403/429 com backoff dos headers da API (Retry-After/x-ratelimit-reset) e repete erros de rate limit do body, totals do stats.json derivam das linhas agregadas (+ warning de datas inválidas), comentários corrigidos (RepoReleasesGrid/teams.vue) e 'releases' morto fora da união section

## 0.40.0

### Minor Changes

- 5d85e18: feat(devs): WeeklyChampions premiar MAIOR EVOLUÇÃO (commits ÷ (média das 8 semanas anteriores + 1), piso 3/semana) em vez de volume puro — no dataset real o campeão de volume levava 82% das semanas; com evolução o líder fica em 28% e as 12 semanas recentes rodam 8 devs

## 0.39.0

### Minor Changes

- 25fb848: feat(teams): página /teams/[name] — dashboard do time com devs travados nos membros (KPIs, timeline, PRs, off-hours), URL compartilhável (escopo de filtros 'team': período+repos), redirect de times renomeados via renamedFrom e link "abrir dashboard" nos cards de /teams

## 0.38.2

### Patch Changes

- 59b242e: chore(lint): adotar ESLint com @antfu/eslint-config (padrão da org, espelhado direto por ser repo OSS) + scripts lint/lint:fix; reformat mecânico do codebase; imports node:process/node:buffer explícitos nos scripts; declarações reordenadas (data.ts/teams.vue) para no-use-before-define

## 0.38.1

### Patch Changes

- fix: achados da revisão pré-push — chave estável nos cards de time, thresholds do OffHoursPanel por modo, guard do passo 4 sem exigir auth, dispensa do banner por identidade, restore de cache filtrado e avisos de teto de paginação; rótulos de docs corrigidos

## 0.38.0

### Minor Changes

- 9ef2494: feat(collect): fuso canônico configurável (GITVIEW_TIMEZONE, default America/Sao_Paulo) — buckets de dia/mês/ISO-semana/fim de semana/madrugada/heatmap independentes do relógio da máquina que coleta (#8)

## 0.37.0

### Minor Changes

- 8a8b5ca: feat(collect): commits de merge excluídos de todas as métricas (--no-merges), decisão documentada no AGENTS.md e aviso não-bloqueante no check-data (#7)

## 0.36.4

### Patch Changes

- 019b9f1: fix(collect-github): paginação de reviews além de 100 (cursor + totalCount) e releases REST paginado com warning em falha de API, sem truncamento silencioso (#6)

## 0.36.3

### Patch Changes

- b9d84ed: fix(collect-github): poda PRs mergeados pela janela de 400d via mergedAt (não só updatedAt) + assert no check-data (#5)

## 0.36.2

### Patch Changes

- 00b2b7e: docs: README público em inglês como principal, pt-BR completo mantido em README.pt-BR.md (decisão #4) + nota do passo opcional do wizard

## 0.36.1

### Patch Changes

- e67509e: docs: CONTRIBUTING.md (setup de dev, gates, estilo, changesets, dev-only vs estático) + seção "Publicar o dashboard" no README (#3)

## 0.36.0

### Minor Changes

- 4a260b6: feat(setup): passo opcional "definir time" no wizard (/setup/team) + banner de identidades sem mapear nas rotas full (#2)

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

- Suporte a múltiplas máquinas/devs: caminho dos repositórios agora é configurável por máquina (env `GITVIEW_REPOS_ROOT`, `config.local.json` gitignored ou auto-detect da pasta `../example`), com erro amigável quando nada é encontrado. Erro claro também quando o GitHub CLI não está instalado/autenticado. README com passo a passo de onboarding.

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

- 863e679: Página dedicada por dev em rota própria (`/dev/:nome`): clique na linha da tabela de devs abre o perfil com cards (commits, linhas, streak, PRs abertos, cycle time mediano, reviews feitas), commits por semana, distribuição por repo, heatmap de horários, PRs abertos do dev e tabela dos últimos 50 commits (data, repo, hash, mensagem, +/−). Coletor git agora exporta `public/data/commits.json` (últimos 100 commits por autor). Router ganha rotas de verdade (`/` e `/dev/:name`); o detalhe inline (DevDetail) foi removido. Fetches de dados usam caminho absoluto para funcionar em qualquer rota; sync de URL só atua no dashboard e é regravado ao voltar do perfil. Logins devlogin-s→Dev V e devlogin-c→Dev O mapeados.

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
