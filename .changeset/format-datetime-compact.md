---
'gitview': patch
---

CommitGraph usa fmtDateTimeShort (dd/mm/aaaa hh:mm, sem segundos) do format.ts no lugar do toLocaleString local, e os cards de time do /teams passam a exibir métricas com fmtCompact (k/M) — a mesma notação do resto do app (antes o Intl compact local gerava "35 mil"/"1,2 mi").
