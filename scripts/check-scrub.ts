/**
 * Gate anti-regressão do scrub de identidade (issue #17): falha se algum
 * arquivo tracked trouxer de volta termos de identidade do empregador.
 *
 * Os termos são montados por fragmentos para o próprio script não se
 * auto-flagar (ele também é um arquivo tracked). Allowlist por LINHA:
 * referências factuais à casa do repo (github.com/Enlighten-Brasil/gitview)
 * e à demo no Pages continuam válidas.
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'

const TERMS: [string, RegExp][] = [
  // rótulo E regex montados por fragmento: nem a linha do rótulo nem a da
  // regex podem conter o termo contíguo, senão o gate se auto-flagaria
  ['en' + 'space', new RegExp('en' + 'space', 'i')],
  ['en-' + 'space', new RegExp('en-' + 'space', 'i')],
  ['be-en' + 'lighten', new RegExp('be-en' + 'lighten', 'i')],
  ['C:' + '\\' + 'Users', new RegExp('C:' + '\\\\' + 'Users', 'i')],
]

const ALLOWLIST = /github\.com\/Enlighten-Brasil\/gitview|enlighten-brasil\.github\.io\/gitview/i

// -z: nomes crus, sem aspas/quotings do git — path com espaço nas pontas ou
// não-ASCII não pode virar "lido como outro arquivo" e cair no catch
const files = execSync('git ls-files -z', { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })
  .split('\0')
  .filter(Boolean)

const hits: string[] = []

for (const file of files) {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  }
  catch (e) {
    // leitura falhou ( corrida com git clean, permissão, path com aspas ):
    // avisa no log em vez de deixar o gate passar em silêncio (fail-open)
    console.warn(`⚠ check-scrub: não li "${file}" — ${e instanceof Error ? e.message : e}`)
    continue
  }
  if (text.includes('\0')) // binário
    continue
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (ALLOWLIST.test(line))
      continue
    for (const [term, re] of TERMS) {
      if (re.test(line))
        hits.push(`${file}:${i + 1}: termo "${term}" → ${line.trim().slice(0, 120)}`)
    }
  }
}

if (hits.length) {
  console.error('✗ check-scrub: termos de identidade encontrados em arquivos tracked:')
  for (const h of hits) console.error(`  - ${h}`)
  console.error('Se for referência factual à casa do repo/demo, ajuste a allowlist em scripts/check-scrub.ts.')
  process.exit(1)
}
console.log(`✓ check-scrub: ${files.length} arquivos tracked limpos`)
