---
'gitview': patch
---

P0: clones gerenciados congelados no tempo. `git clone --bare` não grava `remote.origin.fetch` (o git só grava refspec em clone normal), então o `git fetch --all --prune --tags` de cada coleta só escrevia `FETCH_HEAD`: `refs/heads/*` não avançava nem era podado — commits novos nunca entravam no banco (o dashboard apodrecia em silêncio) e o expurgo de refs mortos jamais disparava. O `cloneBare` agora grava o refspec `+refs/heads/*:refs/heads/*` na criação (`git config` pós-clone — `--config` no comando clone foi medido e falha com "multiple updates for ref not allowed" num bare) e o `fetchRepo` faz backfill idempotente nos clones existentes antes do fetch: o primeiro collect pós-fix se auto-cura (para um buraco longo de congelamento, um `--full` único fecha qualquer edge de committer-date antiga). `denyPush` (pushurl=no-push) preservado e o token segue só via env do processo.
