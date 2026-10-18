---
title: Introdução
description: "Dashboard read-only de métricas de git para qualquer time. Commits, PRs e releases coletados na sua máquina."
---

# Introdução

gitview é um dashboard de métricas de git para qualquer time. Ele acompanha commits, pull requests (PRs) e releases nos repositórios da sua org no GitHub e monta visões por dev, por repo e por time: streak, ritmo, cycle time, fora do horário e resumo semanal.

Tudo roda na sua máquina e a leitura é estritamente read-only: nada é escrito nos repos analisados. Os coletores leem `git log`, `git tag` e a API do GitHub, geram JSON em `public/data/`, e o dashboard só lê desses arquivos. O pipeline está em [Arquitetura](../architecture/pipeline.md).

- **Local**: `pnpm dev` serve o dashboard em `http://localhost:5173`. Banco, clones e JSONs ficam na sua máquina, fora do git.
- **Estático**: `pnpm build` gera um site publicável em qualquer host estático. A [demo pública](https://enlighten-brasil.github.io/gitview/) roda só com dados sintéticos.
- **MIT**: código aberto. Roadmap nas issues e contribuições no [CONTRIBUTING](https://github.com/Enlighten-Brasil/gitview/blob/main/CONTRIBUTING.pt-BR.md).

Comece pelo [Quickstart](./quickstart.md).
