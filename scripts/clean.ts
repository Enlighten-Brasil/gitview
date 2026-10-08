/**
 * `pnpm clean` — apaga os dados gerados (banco + JSONs), mantendo os clones
 * bare de data/repos. `--repos` também apaga os clones (a próxima coleta
 * precisa re-clonar tudo, bem mais lento).
 */
import { cleanLocalData } from './lib/clean'

const includeRepos = process.argv.includes('--repos')
const removed = cleanLocalData(includeRepos)

if (!removed.length) {
  console.log('Nada a limpar — os dados já estão zerados.')
}
else {
  console.log(`Removidos ${removed.length} itens:`)
  for (const p of removed) console.log(`  - ${p}`)
  console.log('\nRode `pnpm collect` (ou o botão ↻ no dashboard) para gerar tudo de novo.')
}
