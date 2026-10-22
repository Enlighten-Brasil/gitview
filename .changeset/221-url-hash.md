---
"gitview": patch
---

`urlState`: `buildUrl` preserva `location.hash`, então as regravações de URL (watcher de filtros e `afterEach`) não descartam mais a âncora — links de sub-âncora ficam compartilháveis e o refresh na URL ancorada mantém o fragmento.
