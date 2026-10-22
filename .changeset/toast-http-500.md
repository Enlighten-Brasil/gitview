---
"gitview": patch
---

loader e App: HTTP >= 500 no loadStats ganha caminho de feedback próprio — toast de erro do servidor com retry, distinto do toast de rede e do caminho silencioso de 404/HTML (que segue para o wizard); o watcher de erro passa a remover o toast anterior antes de adicionar o novo (um toast por vez, reabre após fechamento manual) e o remove agora usa o id real do toast, pois o retorno de add é o objeto e nunca casava com remove(id).
