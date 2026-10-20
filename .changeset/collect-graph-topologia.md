---
'gitview': minor
---

Novo coletor `collect-graph`: topologia de commits por repo em `graph-<repo>.json` (UM arquivo por repo) — hash/parents 40-hex completos, autor canônico, data UTC ISO com ms (author date), subject e decoration de refs/tags, COM merges (os conectores do desenho do grafo; não alimenta o banco nem o stats — decisão #7 intacta). Nova chave `GITVIEW_GRAPH_WINDOW` (janela em CONTAGEM de commits por repo, default 1000; valor inválido cai no default com aviso); `check-data` ganha região própria: valida os graph-*.json presentes (40-hex, ordem descendente, sem hash duplicado, repo == nome do arquivo) e repo do stats sem arquivo é aviso, não erro; a recoleta light não roda o coletor e os graph-*.json existentes sobrevivem a ela; `pnpm collect` inclui o passo entre branches e releases (+ `pnpm collect:graph`); docs EN + pt-BR.
