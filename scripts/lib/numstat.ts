/**
 * Parse do `git log --numstat` do coletor (separadores RS 0x1E entre commits,
 * US 0x1F no cabeçalho) em RawCommit somando só linhas de arquivos
 * não-excluídos — o commit entra mesmo quando TODAS as linhas caem na
 * exclusão (só soma 0/0; decisão #7: o commit conta, as linhas geradas não).
 * Extraído para lib pela revisão do PR da #247 (sugestão da Codacy): collect.ts
 * é um script que se auto-executa, então o parse não era testável no lugar.
 */
export interface RawCommit {
  hash: string
  name: string
  email: string
  date: string
  subject: string
  additions: number
  deletions: number
}

export function parseGitLog(raw: string, isExcluded: (path: string) => boolean): RawCommit[] {
  const commits: RawCommit[] = []
  // cada commit começa com RS (record separator)
  for (const block of raw.split('\x1E')) {
    if (!block.trim())
      continue
    const lines = block.split('\n')
    const header = lines[0].split('\x1F')
    if (header.length < 5)
      continue
    const [hash, name, email, date, subject] = header
    let additions = 0
    let deletions = 0
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line)
        continue
      const parts = line.split('\t')
      if (parts.length < 3)
        continue
      // linhas de arquivos gerados/lockfiles não somam (o commit entra igual)
      if (isExcluded(parts.slice(2).join('\t')))
        continue
      const add = Number(parts[0])
      const del = Number(parts[1])
      if (Number.isFinite(add))
        additions += add
      if (Number.isFinite(del))
        deletions += del
    }
    commits.push({ hash, name, email, date, subject: subject ?? '', additions, deletions })
  }
  return commits
}
