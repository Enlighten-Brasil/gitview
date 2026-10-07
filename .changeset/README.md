# Changesets

Cada alteração relevante deve ter um changeset:

```bash
pnpm changeset        # cria o arquivo de changeset (interativo)
```

Ou criar manualmente um `.md` nesta pasta:

```md
---
"gitview": minor
---

descrição da mudança em pt-BR
```

Para gerar o changelog e bump de versão:

```bash
pnpm version:packages   # consome os changesets -> CHANGELOG.md + bump no package.json
```
