---
'gitview': patch
---

fix(demo): `isoWeekKey` do gerador de fixture dividia por `7 * 876e5` em vez de `7 * 864e5` (typo achado na revisão independente) — as semanas ISO dos buckets semanais corriam ~1% por semana e embaralhavam semanas ≥38; agora espelha o `isoWeekKeyOf` do collect.ts (validado: 13 buckets, 0 divergentes vs as datas dos commits). Também: sort de commits com desempate por hash, remoção de `void lastT` morto e comentário documentando que o fixture ancora em "hoje" (UTC) de propósito
