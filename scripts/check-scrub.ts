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
  ['enspace', new RegExp('en' + 'space', 'i')],
  ['en-space', new RegExp('en-' + 'space', 'i')],
  ['be-enlighten', new RegExp('be-en' + 'lighten', 'i')],
  ['C:\\Users', new RegExp('C:' + '\\\\' + 'Users', 'i')],
]

const ALLOWLIST = /github\.com\/Enlighten-Brasil\/gitview|enlighten-brasil\.github\.io\/gitview/i

const files = execSync('git ls-files', { encoding: 'utf8' })
  .split('\n')
  .map(f => f.trim())
  .filter(Boolean)

const hits: string[] = []

for (const file of files) {
  let text: string
  try {
    text = readFileSync(file, 'utf8')
  }
  catch {
    continue // arquivo some entre ls-files e leitura (corrida) — não é hit
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
