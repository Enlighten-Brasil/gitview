/**
 * Classificação de commits por escopo de ref (issue #118) — lado git.
 *
 * Vocabulário de DADOS gravado no banco (minúsculas, sem renomear):
 * - `prod`: alcançável da ref de produção (resolveProdRef, seam do #117).
 * - `integration`: alcançável de alguma ref de integração (resolveIntegRefs)
 *   e não alcançável de prod.
 * - `branch`: demais commits (por eliminação — inclui os alcançáveis só por
 *   tag, que estão no banco porque o collect usa `--all` mas não aparecem no
 *   walk escoteado, que parte só de `--branches`).
 *
 * `ref_hint` é o nome curto do primeiro ref que alcança o commit:
 * prod → ref de produção; integration → ref de integração (a primeira da
 * ordem da config que o contém); branch → `--source` do walk escoteado;
 * NULL quando nenhuma fonte existe (alcançável só por tag).
 *
 * LIMITAÇÃO medida (issue #118): branch longeva engole a atribuição — no
 * en-space, `legacy-v1` é o source de 55% dos branch commits (119/215). O
 * `--source` atribui o commit ao primeiro ref que o alcança na ordem da
 * caminhada; ref_hint é "primeiro ref alcançável" (melhor esforço), NÃO
 * "a branch onde o trabalho aconteceu".
 *
 * Custos medidos nos 14 repos reais (Windows, clones bare): 23 rev-lists
 * ≈ 1,7 s + 14 walks ≈ 0,8 s = ~2,5 s sequencial (pior repo en-space ~0,4 s).
 * O walk escoteado cobre 100% dos branch commits (215/215 en-space,
 * 121/121 enlighten-api) e nunca retorna tag (parte de `--branches`).
 */
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { resolveIntegRefs, resolveProdRef } from './refs'

export interface RepoScopeSets {
  /** nome curto da ref de produção (vira ref_hint das linhas prod) */
  prodRef: string
  /** todo commit alcançável da ref de produção (merges inclusos) */
  prod: Set<string>
  /** hash → nome da ref de integração (1ª da ordem da config que o contém) */
  integ: Map<string, string>
  /** hash → source do walk escoteado (ref_hint das linhas branch) */
  hints: Map<string, string>
}

/**
 * git com stdout em streaming (padrão do gitLog no collect.ts) — rev-list de
 * repo grande emite centenas de KB e spawnSync estouraria maxBuffer padrão.
 */
function runGit(repoPath: string, args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', ['-C', repoPath, ...args])
    const chunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => chunks.push(c))
    child.stderr.on('data', (c: Buffer) => errChunks.push(c))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`git ${args[0]} falhou em ${repoPath}: ${Buffer.concat(errChunks).toString().trim()}`))
        return
      }
      resolvePromise(Buffer.concat(chunks).toString('utf-8'))
    })
  })
}

/** nomes de ref não contêm espaço (git check-ref-format) — split seguro */
function parseHashRefPairs(out: string): [string, string][] {
  const pairs: [string, string][] = []
  for (const line of out.split('\n')) {
    const sep = line.indexOf(' ')
    if (sep <= 0)
      continue
    const hash = line.slice(0, sep)
    const ref = line.slice(sep + 1).trim()
    if (ref)
      pairs.push([hash, ref])
  }
  return pairs
}

/** 'refs/heads/x' → 'x' (o %S costuma sair curto; strip defensivo) */
function shortSource(source: string): string {
  return source.replace(/^refs\/heads\//, '')
}

/**
 * Monta os sets completos de classificação de UM repo (side-effect: nenhum —
 * só comandos de leitura: rev-parse/symbolic-ref do seam + rev-list + log).
 *
 * O walk escoteado usa UM único `--not` seguido de todos os refs — a flag
 * `--not` alterna a polaridade dos refs seguintes, então `--not prod --not
 * develop` devolve develop ao lado positivo e contamina o walk com commits de
 * integração (medido: en-docs 50 linhas vs 9 na forma correta).
 */
export async function collectScopeSets(
  repoPath: string,
  productionRef?: string,
  integrationRefs?: string[],
): Promise<RepoScopeSets> {
  const prodRef = resolveProdRef(repoPath, productionRef)
  const integRefs = resolveIntegRefs(repoPath, integrationRefs)

  const [prodOut, integOuts, walkOut] = await Promise.all([
    runGit(repoPath, ['rev-list', prodRef]),
    Promise.all(integRefs.map(ref => runGit(repoPath, ['rev-list', ref, '--not', prodRef]))),
    // walk escoteado da issue #118: cobre 100% dos branch commits com source,
    // nunca retorna tag (--branches) — 165-246 ms/repo medido
    runGit(repoPath, [
      'log',
      '--branches',
      '--not',
      prodRef,
      ...integRefs,
      '--source',
      '--no-merges',
      '--pretty=format:%H %S',
    ]),
  ])

  const prod = new Set(prodOut.split('\n').filter(Boolean))
  const integ = new Map<string, string>()
  integRefs.forEach((ref, i) => {
    for (const hash of integOuts[i].split('\n').filter(Boolean)) {
      // primeira ref da ordem da config vence (determinístico por execução)
      if (!integ.has(hash))
        integ.set(hash, ref)
    }
  })
  const hints = new Map<string, string>()
  for (const [hash, source] of parseHashRefPairs(walkOut))
    hints.set(hash, shortSource(source))

  return { prodRef, prod, integ, hints }
}
