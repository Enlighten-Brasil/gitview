/**
 * Estado do wizard de onboarding: a seleção do passo 2 (org + repos) sobrevive
 * a F5/back no sessionStorage — sem isso, recarregar o passo 3 jogaria o usuário
 * de volta sem saber o que clonar.
 */
export interface WizardSelection {
  org: string
  repos: string[]
}

const KEY = 'gitview:wizard:selection'

export function readWizardSelection(): WizardSelection | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<WizardSelection>
    if (typeof parsed.org === 'string' && parsed.org && Array.isArray(parsed.repos) && parsed.repos.length)
      return { org: parsed.org, repos: parsed.repos.map(String) }
  }
  catch {
    // storage corrompido = sem seleção
  }
  return null
}

export function writeWizardSelection(selection: WizardSelection | null): void {
  if (selection) sessionStorage.setItem(KEY, JSON.stringify(selection))
  else sessionStorage.removeItem(KEY)
}
