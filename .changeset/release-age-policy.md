---
'gitview': patch
---

fix(ci): policy `minimumReleaseAge: 1440` pinada no `pnpm-workspace.yaml` (determinismo: o config global de máquina podia zerar e o CI divergia — primeiro push de main falhou no `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`) + `eslint` volta pro piso `^10.12.0` e lockfile regenerado sob a policy (só versões maduras); CONTRIBUTING par documenta o comportamento esperado para bumps recentes
