import type { GithubTeamData, MemberAddItem, ProfileDraft, TeamConfigPayload, TeamDraft, TeamMetrics } from '@/team'
import { useToast } from '@nuxt/ui/composables'
import { computed, reactive, ref } from 'vue'
import { startCollect } from '@/collect'
import { useConfirm } from '@/composables/useConfirm'
import { stats } from '@/data'
import { github } from '@/github'
import { getComposer } from '@/i18n'
import {
  dedupeList,
  fetchTeamConfig,
  loadTeam,
  saveTeamConfig,
  splitList,
  team,
  TEAM_PALETTE,
  toProfileDraft,
  toTeamDraft,
  toTeamEntry,
} from '@/team'

/**
 * Drafts do editor de times (/teams): perfis de devs + times em estado local,
 * payload/dirty/snapshot pro POST /__team/config. A página vira orquestração —
 * quem muta estado é este composable (issue #40), nunca os componentes.
 */
export function useTeamDrafts() {
  const toast = useToast()
  const confirm = useConfirm()
  // composer global (módulo fora de componente) — o bootstrap já rodou quando a
  // página monta; traduz só o copy de toasts/confirmações/erros, a lógica não muda
  const { t } = getComposer()

  // ---------------------------------------------------------------------------
  // estado dos drafts
  // ---------------------------------------------------------------------------
  const profiles = reactive<Record<string, ProfileDraft>>({})
  const teams = ref<TeamDraft[]>([])
  /** último payload salvo — base do dirty e do revert */
  const savedSnapshot = ref<TeamConfigPayload>({ devProfiles: {}, teams: [] })
  const configLoaded = ref(false)
  const saving = ref(false)

  function profileOf(name: string): ProfileDraft {
    if (!profiles[name])
      profiles[name] = toProfileDraft()
    return profiles[name]
  }

  /** aplica a edição do modal (normaliza as listas — dedupe impede duplicata no team.local.json, issue #30) */
  function applyProfile(name: string, draft: ProfileDraft) {
    profiles[name] = {
      ...draft,
      emails: dedupeList(draft.emails).join(', '),
      githubLogins: dedupeList(draft.githubLogins).join(', '),
    }
  }

  // ---------------------------------------------------------------------------
  // payload / dirty / snapshot
  // ---------------------------------------------------------------------------
  function payload(): TeamConfigPayload {
    const devProfiles: TeamConfigPayload['devProfiles'] = {}
    for (const [name, p] of Object.entries(profiles)) {
      const entry: TeamConfigPayload['devProfiles'][string] = {}
      if (p.title.trim())
        entry.title = p.title.trim()
      if (p.description.trim())
        entry.description = p.description.trim()
      const emails = dedupeList(p.emails)
      const logins = dedupeList(p.githubLogins)
      if (emails.length)
        entry.emails = emails
      if (logins.length)
        entry.githubLogins = logins
      if (Object.keys(entry).length)
        devProfiles[name] = entry
    }
    return {
      devProfiles,
      teams: teams.value
        .filter(t => t.name.trim())
        .map(toTeamEntry),
    }
  }

  /**
   * serialização estável: chaves de objeto em ordem alfabética — o JSON.stringify
   *  puro é sensível à ordem de inserção das chaves e acusava "não salvo" fantasma
   *  sem mudança real (issue #30)
   */
  function stableStringify(v: unknown): string {
    if (Array.isArray(v))
      return `[${v.map(stableStringify).join(',')}]`
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>
      return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`
    }
    return JSON.stringify(v)
  }

  // dirty compara o estado bruto dos times (incluindo rascunhos sem nome) + o payload
  // completo (perfis/times efetivos) contra o snapshot pós-save. Time vazio conta
  // como mudança — senão o usuário perde o rascunho ao sair sem perceber.
  const dirty = computed(() => {
    const saved = savedSnapshot.value
    // perfis: compara payload efetivo (serialização estável — insensitive à ordem das chaves)
    if (stableStringify(payload().devProfiles) !== stableStringify(saved.devProfiles))
      return true
    // times: compara estado bruto (sem filtrar nome vazio)
    const cur = teams.value.map(t => ({ n: t.name.trim(), d: t.description.trim(), c: t.color.trim(), m: [...t.members] }))
    const old = saved.teams.map(t => ({ n: t.name, d: t.description ?? '', c: t.color ?? '', m: t.members }))
    return stableStringify(cur) !== stableStringify(old)
  })

  // ---------------------------------------------------------------------------
  // persistência (/__team/config)
  // ---------------------------------------------------------------------------
  async function save(skipRefresh = false): Promise<boolean> {
    saving.value = true
    try {
      const p = payload()
      const res = await saveTeamConfig(p, { skipRefresh })
      savedSnapshot.value = p
      // o que era rascunho virou salvo: savedName/renamedFrom alinham por
      // construção (a entrada do PRÓPRIO draft), não por find-por-nome
      for (const t of teams.value) {
        if (!t.name.trim())
          continue
        const entry = toTeamEntry(t)
        t.savedName = entry.name
        t.renamedFrom = [...(entry.renamedFrom ?? [])]
      }
      // o endpoint regenerou o team.json no save — refaz o fetch p/ chips da
      // sidebar, /teams/<nome> e dashboards refletirem a edição sem recoleta
      if (res.teamRefreshed)
        await loadTeam(true)
      if (res.warnings?.length)
        toast.add({ title: t('team.toast.savedWithWarnings'), description: res.warnings.join(' · '), color: 'warning' })
      else if (skipRefresh)
        toast.add({ title: t('team.toast.savedTitle'), description: t('team.toast.savedRecollect'), color: 'success' })
      else
        toast.add({ title: t('team.toast.savedTitle'), description: t('team.toast.savedInstant'), color: 'success' })
      return true
    }
    catch (err) {
      toast.add({ title: t('team.toast.saveError'), description: String((err as Error).message ?? err), color: 'error' })
      return false
    }
    finally {
      saving.value = false
    }
  }

  async function saveAndRecollect() {
    // não recoleta se o salvar falhou (a coleta usaria a config antiga).
    // A recoleta leve (--reaggregate) re-aplica aliases no banco e re-gera os
    // JSONs SEM re-escanear o git — segundos em vez de minutos. (Remover alias
    // não reverte nomes já gravados — isso só a limpeza completa refaz.)
    // skipRefresh: a recoleta já regenera o team.json — pular o refresh do POST
    // evita rodar collect-team + check-data duas vezes (follow-up #12).
    if (await save(true))
      startCollect(false, false, true)
  }

  /** volta os rascunhos ao último estado salvo (descarta edições) — destrutivo, pede confirmação */
  async function revert() {
    const ok = await confirm({
      title: t('team.revert.confirm.title'),
      description: t('team.revert.confirm.description'),
      confirmLabel: t('team.revert.confirm.confirm'),
      cancelLabel: t('team.revert.confirm.cancel'),
    })
    if (!ok)
      return
    const saved = savedSnapshot.value
    for (const k of Object.keys(profiles))
      delete profiles[k]
    for (const [name, p] of Object.entries(saved.devProfiles))
      profiles[name] = toProfileDraft(p)
    teams.value = saved.teams.map(toTeamDraft)
    toast.add({ title: t('team.toast.reverted'), color: 'neutral' })
  }

  /** carrega a config persistida (team.local.json) pros drafts */
  async function loadConfigState() {
    try {
      const cfg = await fetchTeamConfig()
      for (const k of Object.keys(profiles))
        delete profiles[k]
      for (const [name, p] of Object.entries(cfg.devProfiles))
        profiles[name] = toProfileDraft(p)
      teams.value = cfg.teams.map(toTeamDraft)
      savedSnapshot.value = payload()
      configLoaded.value = true
    }
    catch {
      // dev server sem os endpoints (build estático / endpoint fora do ar)
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD de times — identidade SEMPRE por cid (nunca por índice do v-for)
  // ---------------------------------------------------------------------------
  function addTeam() {
    const draft = toTeamDraft({ name: '', members: [] })
    draft.color = TEAM_PALETTE[teams.value.length % TEAM_PALETTE.length]
    teams.value.push(draft)
  }

  function removeTeam(cid: string) {
    teams.value = teams.value.filter(t => t.cid !== cid)
  }

  function addMember(cid: string, value: string) {
    const t = teams.value.find(x => x.cid === cid)
    if (t && !t.members.includes(value))
      t.members.push(value)
  }

  function removeMember(cid: string, value: string) {
    const t = teams.value.find(x => x.cid === cid)
    if (t)
      t.members = t.members.filter(m => m !== value)
  }

  /** importa um time da org (logins já resolvidos pra devs pelos aliases) */
  function importTeam(tm: GithubTeamData['teams'][number]) {
    const loginToDev = new Map<string, string>()
    for (const d of team.value?.devs ?? []) {
      for (const l of d.githubLogins)
        loginToDev.set(l.toLowerCase(), d.name)
    }
    const members = [...new Set(
      tm.members.map(l => loginToDev.get(l.toLowerCase())).filter((m): m is string => !!m),
    )]
    // sobrescrever um time salvo mantém a identidade "salva" dele (cid, savedName,
    // histórico de nomes) — senão o rename anterior desapareceria do config no save
    const prev = teams.value.find(x => x.name.toLowerCase() === tm.name.toLowerCase())
    const draftTeam: TeamDraft = {
      ...toTeamDraft({ name: tm.name, description: tm.description, members }),
      color: TEAM_PALETTE[teams.value.length % TEAM_PALETTE.length],
      ...(prev ? { cid: prev.cid, renamedFrom: [...prev.renamedFrom], savedName: prev.savedName } : {}),
    }
    if (prev)
      Object.assign(prev, draftTeam)
    else
      teams.value.push(draftTeam)
    toast.add({ title: t('team.toast.imported.title', { name: tm.name }), description: t('team.toast.imported.description', { mapped: members.length, total: tm.members.length }), color: 'info' })
  }

  /** associa login candidato a um dev existente (adiciona no perfil dele) */
  function assignLogin(dev: string, login: string) {
    const p = profileOf(dev)
    const logins = splitList(p.githubLogins)
    if (!logins.some(l => l.toLowerCase() === login.toLowerCase())) {
      p.githubLogins = [...logins, login].join(', ')
      toast.add({ title: t('team.toast.loginLinked.title'), description: t('team.toast.loginLinked.description', { login, dev }), color: 'success' })
    }
  }

  /** associa e-mails candidatos a um dev existente (adiciona no perfil dele) */
  function assignEmails(dev: string, emails: string[]) {
    const p = profileOf(dev)
    const current = splitList(p.emails)
    const merged = [...current]
    for (const e of emails) {
      if (!merged.some(x => x.toLowerCase() === e.toLowerCase()))
        merged.push(e)
    }
    p.emails = merged.join(', ')
    toast.add({ title: t('team.toast.emailsLinked.title'), description: t('team.toast.emailsLinked.description', { list: emails.join(', '), dev }), color: 'success' })
  }

  // ---------------------------------------------------------------------------
  // visualização derivada (cacheada — nada de função por item no template)
  // ---------------------------------------------------------------------------
  const devs = computed(() => team.value?.devs ?? [])
  const devNames = computed(() => devs.value.filter(d => !d.bot).map(d => d.name).sort())
  const candidates = computed(() => team.value?.candidates ?? [])
  /** autores com commits nos dados → link pro perfil em /devs/:name */
  const authorsWithCommits = computed(() => new Set((stats.value?.perAuthor ?? []).map(a => a.author)))

  /** login do GitHub -> nome canônico (github.json#users) */
  const loginToName = computed(() => {
    const map = new Map<string, string>()
    for (const [login, u] of Object.entries(github.value?.users ?? {}))
      map.set(login.toLowerCase(), u.name)
    return map
  })

  function metricsOf(members: string[]): TeamMetrics {
    const set = new Set(members)
    let commits = 0
    let last: string | null = null
    for (const a of stats.value?.perAuthor ?? []) {
      if (!set.has(a.author))
        continue
      commits += a.commits
      if (a.lastCommit > (last ?? ''))
        last = a.lastCommit
    }
    let prs = 0
    for (const p of github.value?.prs ?? []) {
      const name = loginToName.value.get(p.author.toLowerCase()) ?? p.author
      if (set.has(name))
        prs++
    }
    return { devs: members.length, commits, prs, lastCommit: last }
  }

  /** métricas por cid (total histórico — a página não segue o filtro de período) */
  const metricsByCid = computed(() => new Map(teams.value.map(t => [t.cid, metricsOf(t.members)])))

  /** dev → nomes dos outros times em que já aparece (hint de duplicidade no select) */
  function otherTeamsOf(dev: string, currentCid: string): string[] {
    return teams.value
      .filter(t => t.cid !== currentCid && t.members.includes(dev) && t.name.trim())
      .map(t => t.name.trim())
  }

  /** opções do add-member por cid: exclui quem já está no time, marca quem está em outro */
  const addItemsByCid = computed(() => {
    const map = new Map<string, MemberAddItem[]>()
    for (const tm of teams.value) {
      const inTeam = new Set(tm.members)
      map.set(tm.cid, devNames.value
        .filter(d => !inTeam.has(d))
        .map((d) => {
          const others = otherTeamsOf(d, tm.cid)
          return { label: d, value: d, hint: others.length ? t('team.card.alreadyIn', { teams: others.join(', ') }) : undefined }
        }))
    }
    return map
  })

  /** badges de time por dev com a cor vigente (rascunho do editor > team.json) */
  const teamBadgesByDev = computed(() => {
    const map = new Map<string, { name: string, color: string | null }[]>()
    for (const d of devs.value) {
      map.set(d.name, d.teams.map((name) => {
        const draft = teams.value.find(t => t.name.trim().toLowerCase() === name.toLowerCase())
        return {
          name: draft?.name.trim() || name,
          color: draft?.color || team.value?.teams.find(t => t.name === name)?.color || null,
        }
      }))
    }
    return map
  })

  return {
    addItemsByCid,
    addMember,
    addTeam,
    applyProfile,
    assignEmails,
    assignLogin,
    authorsWithCommits,
    candidates,
    configLoaded,
    devNames,
    devs,
    dirty,
    importTeam,
    loadConfigState,
    metricsByCid,
    profileOf,
    profiles,
    removeMember,
    removeTeam,
    revert,
    save,
    saveAndRecollect,
    saving,
    teamBadgesByDev,
    teams,
  }
}
