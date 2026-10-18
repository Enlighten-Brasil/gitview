/**
 * Gate de paridade EN ↔ pt-BR do site de docs (issue #73): cada página EN sob
 * `docs/` deve ter o espelho pt-BR no MESMO caminho relativo sob `docs/pt-BR/`
 * e vice-versa — espelho órfão em pt-BR também é violação. O gate compara os
 * CONJUNTOS de caminhos relativos; a literalidade da Proposta (glob
 * `*.pt-BR.md`) descrevia a pasta de rascunhos antiga, que não existe no repo:
 * o espelho vive no diretório `docs/pt-BR/` com o mesmo nome de arquivo.
 *
 * Estética do check-scrub.ts (issue #17): violação imprime `arquivo: motivo`
 * e sai 1; verde imprime o resumo. Falha de leitura de arquivo/diretório vira
 * warning VISÍVEL no stderr + isenção do par no run (fail-open visível, nunca
 * catch silencioso). Só node:fs/node:path, zero dependências novas.
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const DOCS_ROOT = 'docs'
const PT_PREFIX = 'pt-BR/'
// fora da árvore de páginas: config/cache do VitePress, assets públicos e
// deps do workspace (qualquer diretório oculto também sai). `pt-BR/` NÃO é
// ignorado: a varredura única coleta as duas árvores e a paridade é o diff.
const SKIPPED_DIRS = new Set(['.vitepress', 'node_modules', 'public'])

/**
 * Varredura recursiva de `docs/` coletando os `.md` como caminhos relativos
 * com `/` (posix-like) → caminho absoluto nativo. Falha de readdir é warning
 * visível + continue: um diretório ilegível não pode virar "violação" nem
 * sumir em silêncio.
 */
function walkMarkdown(absDir: string, relDir: string, acc: Map<string, string>): void {
  let entries
  try {
    entries = readdirSync(absDir, { withFileTypes: true })
  }
  catch (e) {
    console.warn(`⚠ check-docs: falhou listar "${relDir || DOCS_ROOT}" — ${e instanceof Error ? e.message : e}`)
    return
  }
  for (const ent of entries) {
    if (ent.isDirectory()) {
      if (SKIPPED_DIRS.has(ent.name) || ent.name.startsWith('.'))
        continue
      walkMarkdown(path.join(absDir, ent.name), relDir ? `${relDir}/${ent.name}` : ent.name, acc)
      continue
    }
    if (ent.isFile() && ent.name.endsWith('.md'))
      acc.set(relDir ? `${relDir}/${ent.name}` : ent.name, path.join(absDir, ent.name))
  }
}

// caminho da página EN correspondente a um rel qualquer ('x' ou 'pt-BR/x')
const pairKey = (rel: string): string => (rel.startsWith(PT_PREFIX) ? rel.slice(PT_PREFIX.length) : rel)
const counterpart = (rel: string): string => (rel.startsWith(PT_PREFIX) ? pairKey(rel) : `${PT_PREFIX}${rel}`)

const pages = new Map<string, string>()
walkMarkdown(DOCS_ROOT, '', pages)

for (const [rel, abs] of [...pages]) {
  try {
    readFileSync(abs, 'utf8')
  }
  catch (e) {
    console.warn(`⚠ check-docs: não li "${DOCS_ROOT}/${rel}" — ${e instanceof Error ? e.message : e}; par isento neste run`)
    // se QUALQUER lado do par {x, pt-BR/x} não for legível, o par inteiro é
    // isento: isenção de um lado só geraria "falta espelho"/"órfão" falso
    pages.delete(rel)
    pages.delete(counterpart(rel))
  }
}

const en = [...pages.keys()].filter(rel => !rel.startsWith(PT_PREFIX)).sort()
const pt = [...pages.keys()].filter(rel => rel.startsWith(PT_PREFIX)).sort()

const violations: string[] = []
const ptSet = new Set(pt)
const enSet = new Set(en)

for (const rel of en) {
  if (!ptSet.has(`${PT_PREFIX}${rel}`))
    violations.push(`${DOCS_ROOT}/${rel}: falta o espelho pt-BR em ${DOCS_ROOT}/${PT_PREFIX}${rel}`)
}
for (const rel of pt) {
  if (!enSet.has(pairKey(rel)))
    violations.push(`${DOCS_ROOT}/${rel}: espelho órfão sem página EN em ${DOCS_ROOT}/${pairKey(rel)}`)
}

if (en.length === 0 && violations.length === 0) {
  // árvore EN vazia nunca é paridade: sinaliza docs/ renomeada/removida em
  // vez de deixar o gate passar verde sobre nada
  console.error(`✗ check-docs: nenhum .md EN encontrado sob ${DOCS_ROOT}/ — a árvore de docs está vazia ou renomeada?`)
  process.exit(1)
}

if (violations.length) {
  console.error(`✗ check-docs: paridade EN ↔ pt-BR quebrada (${violations.length} violação(ões)):`)
  for (const v of violations)
    console.error(`  - ${v}`)
  console.error('Cada página EN exige o espelho no mesmo caminho relativo sob docs/pt-BR/, e vice-versa.')
  process.exit(1)
}

console.log(`✓ docs: ${en.length} páginas EN, ${pt.length} espelhos pt-BR, paridade ok`)
