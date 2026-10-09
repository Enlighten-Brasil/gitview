<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useToast } from '@nuxt/ui/composables'
import { onBeforeRouteLeave } from 'vue-router'
import { collecting, startCollect } from '@/collect'
import { fetchGithubTeam, fetchTeamConfig, loadTeam, saveTeamConfig, team, teamLoadError } from '@/team'
import type { GithubTeamData, TeamConfigPayload } from '@/team'

// gerência do time (era /team — alias mantém links/bookmarks)
definePage({
  alias: '/team',
  meta: {
    section: 'teams',
    filters: 'none',
    title: 'Times',
  },
})

const isDev = import.meta.env.DEV
const toast = useToast()

onMounted(async () => {
  await loadTeam(true)
  // build estático: sem endpoints de config — times vêm do team.json (somente leitura)
  if (!isDev) {
    teams.value = (team.value?.teams ?? []).map(t => ({
      name: t.name,
      description: t.description ?? '',
      color: t.color ?? '',
      members: [...t.members],
    }))
  }
})
onMounted(loadConfigState)

// ---------------------------------------------------------------------------
// estado da config (perfis + times)
// ---------------------------------------------------------------------------
interface ProfileDraft {
  title: string
  description: string
  emails: string
  githubLogins: string
}
interface TeamDraft {
  name: string
  description: string
  color: string
  members: string[]
}

const profiles = reactive<Record<string, ProfileDraft>>({})
const teams = ref<TeamDraft[]>([])
const configLoaded = ref(false)
const saving = ref(false)

function toDraft(p: { title?: string, description?: string, emails?: string[], githubLogins?: string[] } | undefined): ProfileDraft {
  return {
    title: p?.title ?? '',
    description: p?.description ?? '',
    emails: (p?.emails ?? []).join(', '),
    githubLogins: (p?.githubLogins ?? []).join(', '),
  }
}

async function loadConfigState() {
  if (!isDev) return
  try {
    const cfg = await fetchTeamConfig()
    for (const k of Object.keys(profiles)) delete profiles[k]
    for (const [name, p] of Object.entries(cfg.devProfiles)) profiles[name] = toDraft(p)
    teams.value = cfg.teams.map(t => ({
      name: t.name,
      description: t.description ?? '',
      color: t.color ?? '',
      members: [...t.members],
    }))
    savedSnapshot.value = payload()
    configLoaded.value = true
  }
  catch {
    // dev server sem os endpoints (build estático / endpoint fora do ar)
  }
}

function splitList(s: string): string[] {
  return s.split(',').map(x => x.trim()).filter(Boolean)
}

function payload(): TeamConfigPayload {
  const devProfiles: TeamConfigPayload['devProfiles'] = {}
  for (const [name, p] of Object.entries(profiles)) {
    const entry: TeamConfigPayload['devProfiles'][string] = {}
    if (p.title.trim()) entry.title = p.title.trim()
    if (p.description.trim()) entry.description = p.description.trim()
    const emails = splitList(p.emails)
    const logins = splitList(p.githubLogins)
    if (emails.length) entry.emails = emails
    if (logins.length) entry.githubLogins = logins
    if (Object.keys(entry).length) devProfiles[name] = entry
  }
  return {
    devProfiles,
    teams: teams.value
      .filter(t => t.name.trim())
      .map(t => ({
        name: t.name.trim(),
        ...(t.description.trim() ? { description: t.description.trim() } : {}),
        ...(t.color.trim() ? { color: t.color.trim() } : {}),
        members: t.members,
      })),
  }
}

// dirty compara o estado bruto dos times (incluindo rascunhos sem nome) + o payload
// completo (perfis/times efetivos) contra o snapshot pós-save. Time vazio conta
// como mudança — senão o usuário perde o rascunho ao sair sem perceber.
const dirty = computed(() => {
  const saved = savedSnapshot.value
  // perfis: compara payload efetivo
  if (JSON.stringify(payload().devProfiles) !== JSON.stringify(saved.devProfiles))
    return true
  // times: compara estado bruto (sem filtrar nome vazio)
  const cur = teams.value.map(t => ({ n: t.name.trim(), d: t.description.trim(), c: t.color.trim(), m: [...t.members] }))
  const old = saved.teams.map(t => ({ n: t.name, d: t.description ?? '', c: t.color ?? '', m: t.members }))
  return JSON.stringify(cur) !== JSON.stringify(old)
})
const savedSnapshot = ref<TeamConfigPayload>({ devProfiles: {}, teams: [] })

async function save(): Promise<boolean> {
  saving.value = true
  try {
    const p = payload()
    await saveTeamConfig(p)
    savedSnapshot.value = p
    toast.add({ title: 'perfis salvos', description: 'rode a recoleta pra aplicar nos dados', color: 'success' })
    return true
  }
  catch (err) {
    toast.add({ title: 'erro ao salvar', description: String((err as Error).message ?? err), color: 'error' })
    return false
  }
  finally {
    saving.value = false
  }
}

async function saveAndRecollect() {
  // não recoleta se o salvar falhou (a coleta usaria a config antiga)
  if (await save())
    startCollect(true)
}

// ---------------------------------------------------------------------------
// edição de perfil (modal)
// ---------------------------------------------------------------------------
const editing = ref<string | null>(null)
const draft = ref<ProfileDraft>(toDraft(undefined))

function profileOf(name: string): ProfileDraft {
  if (!profiles[name]) profiles[name] = toDraft(undefined)
  return profiles[name]
}

function openEdit(name: string) {
  editing.value = name
  draft.value = { ...profileOf(name) }
}

function confirmEdit() {
  if (editing.value) profiles[editing.value] = { ...draft.value }
  editing.value = null
}

// ---------------------------------------------------------------------------
// times
// ---------------------------------------------------------------------------
const devNames = computed(() => (team.value?.devs ?? []).filter(d => !d.bot).map(d => d.name).sort())
const PALETTE = ['#8b5cf6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#f97316']

/** dev → nomes dos outros times em que já aparece (pra hint de duplicidade no select) */
function otherTeamsOf(dev: string, currentIdx: number): string[] {
  return teams.value
    .filter((t, i) => i !== currentIdx && t.members.includes(dev) && t.name.trim())
    .map(t => t.name.trim())
}

/** opções do select de membros de um time — marca quem já está em outro time */
function memberItems(currentIdx: number): { label: string, value: string, hint?: string }[] {
  return devNames.value.map(d => {
    const others = otherTeamsOf(d, currentIdx)
    return { label: d, value: d, hint: others.length ? `já em: ${others.join(', ')}` : undefined }
  })
}

function addTeam() {
  teams.value.push({ name: '', description: '', color: PALETTE[teams.value.length % PALETTE.length], members: [] })
}

function removeTeam(i: number) {
  const t = teams.value[i]
  const label = t.name.trim() || '(sem nome)'
  if (!window.confirm(`remover o time "${label}"? a mudança só é persistida ao salvar.`))
    return
  teams.value.splice(i, 1)
}

// guarda de navegação: avisa antes de sair da página com mudanças não salvas
const DIRTY_MSG = 'você tem mudanças não salvas no time — sair mesmo assim?'
onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm(DIRTY_MSG))
    return false
})
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', onBeforeUnload))

function teamColor(name: string): string | null {
  return teams.value.find(t => t.name === name)?.color || team.value?.teams.find(t => t.name === name)?.color || null
}

// ---------------------------------------------------------------------------
// importar do GitHub
// ---------------------------------------------------------------------------
const gh = ref<GithubTeamData | null>(null)
const ghLoading = ref(false)
const ghError = ref<string | null>(null)
const showImport = ref(false)

async function loadGithub() {
  ghLoading.value = true
  ghError.value = null
  try {
    gh.value = await fetchGithubTeam()
  }
  catch (err) {
    ghError.value = String((err as Error).message ?? err)
  }
  finally {
    ghLoading.value = false
  }
}

function openImport() {
  showImport.value = true
  if (!gh.value) loadGithub()
}

/** logins da org ainda não mapeados pra nenhum dev */
const unmappedGhMembers = computed(() => {
  if (!gh.value || !team.value) return []
  const mapped = new Set(team.value.devs.flatMap(d => d.githubLogins.map(l => l.toLowerCase())))
  const bots = new Set(team.value.devs.filter(d => d.bot).flatMap(d => d.githubLogins.map(l => l.toLowerCase())))
  return gh.value.members.filter(m => !mapped.has(m.login.toLowerCase()) && !bots.has(m.login.toLowerCase()))
})

function importTeam(t: { name: string, description: string | null, members: string[] }) {
  const loginToDev = new Map<string, string>()
  for (const d of team.value?.devs ?? []) {
    for (const l of d.githubLogins) loginToDev.set(l.toLowerCase(), d.name)
  }
  const members = [...new Set(
    t.members.map(l => loginToDev.get(l.toLowerCase())).filter((m): m is string => !!m),
  )]
  const existing = teams.value.findIndex(x => x.name.toLowerCase() === t.name.toLowerCase())
  const draftTeam: TeamDraft = {
    name: t.name,
    description: t.description ?? '',
    color: PALETTE[teams.value.length % PALETTE.length],
    members,
  }
  if (existing >= 0) teams.value[existing] = draftTeam
  else teams.value.push(draftTeam)
  toast.add({ title: `time "${t.name}" importado`, description: `${members.length}/${t.members.length} membros mapeados — revise e salve`, color: 'info' })
  showImport.value = false
}

/** associa login candidato a um dev existente (adiciona no perfil dele) */
function assignLogin(dev: string, login: string) {
  const p = profileOf(dev)
  const logins = splitList(p.githubLogins)
  if (!logins.some(l => l.toLowerCase() === login.toLowerCase())) {
    p.githubLogins = [...logins, login].join(', ')
  }
}

function assignEmails(dev: string, emails: string[]) {
  const p = profileOf(dev)
  const current = splitList(p.emails)
  const merged = [...current]
  for (const e of emails) {
    if (!merged.some(x => x.toLowerCase() === e.toLowerCase())) merged.push(e)
  }
  p.emails = merged.join(', ')
}

// ---------------------------------------------------------------------------
// visão
// ---------------------------------------------------------------------------
const devs = computed(() => team.value?.devs ?? [])
const candidates = computed(() => team.value?.candidates ?? [])
const assignTarget = reactive<Record<string, string>>({})
</script>

<template>
  <div class="flex flex-col gap-6 p-4 sm:p-6 max-w-6xl mx-auto w-full">
    <div class="flex items-center gap-3 flex-wrap">
      <div>
        <h1 class="text-xl font-semibold">
          Times
        </h1>
        <p class="text-sm text-dimmed">
          Perfis de devs, aliases (e-mails e logins) e times. Salvo em <code class="text-xs">team.local.json</code> (só na sua máquina).
        </p>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <UButton
          v-if="isDev"
          icon="i-lucide-github"
          color="neutral"
          variant="soft"
          size="sm"
          label="importar do GitHub"
          @click="openImport"
        />
        <UButton
          v-if="isDev && configLoaded"
          icon="i-lucide-save"
          size="sm"
          :loading="saving"
          :disabled="!dirty"
          label="salvar"
          @click="save"
        />
        <UTooltip v-if="isDev && configLoaded" text="salva e roda a coleta completa (recria stats/github com os novos aliases)">
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="soft"
            size="sm"
            :loading="collecting"
            label="salvar + recoletar"
            @click="saveAndRecollect"
          />
        </UTooltip>
      </div>
    </div>

    <UAlert
      v-if="!isDev"
      color="warning"
      variant="subtle"
      icon="i-lucide-lock"
      title="edição só no modo dev"
      description="No build estático esta página é somente leitura (perfis e times definidos em team.local.json)."
    />
    <UAlert
      v-if="teamLoadError"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="team.json não encontrado"
      description="Rode a coleta (pnpm collect) pra gerar os dados do time."
    />

    <!-- times -->
    <section id="times" class="flex flex-col gap-3 scroll-mt-16">
      <div class="flex items-center gap-2">
        <h2 class="font-medium">
          Times
        </h2>
        <UBadge color="neutral" variant="subtle" size="sm">
          {{ teams.length }}
        </UBadge>
        <UButton
          v-if="isDev && configLoaded"
          icon="i-lucide-plus"
          size="xs"
          color="neutral"
          variant="soft"
          label="novo time"
          class="ml-auto"
          @click="addTeam"
        />
      </div>
      <p v-if="!teams.length" class="text-sm text-dimmed">
        Nenhum time ainda. Importe do GitHub ou crie manualmente.
      </p>
      <div class="grid gap-3 md:grid-cols-2">
        <UCard v-for="(t, i) in teams" :key="i">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span
                class="size-3 rounded-full shrink-0 border border-default"
                :style="{ backgroundColor: t.color || 'transparent' }"
              />
              <UInput v-model="t.name" :disabled="!isDev" placeholder="nome do time" size="sm" class="flex-1" />
              <UButton
                v-if="isDev"
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                size="xs"
                aria-label="remover time"
                @click="removeTeam(i)"
              />
            </div>
            <div class="flex items-center gap-2">
              <UInput v-model="t.color" :disabled="!isDev" placeholder="#8b5cf6" size="xs" class="w-24 font-mono" />
              <UInput v-model="t.description" :disabled="!isDev" placeholder="descrição (opcional)" size="xs" class="flex-1" />
            </div>
            <USelectMenu
              v-model="t.members"
              :items="memberItems(i)"
              multiple
              :disabled="!isDev"
              placeholder="membros…"
              size="sm"
              class="w-full"
              value-key="value"
            />
            <div class="flex flex-wrap gap-1">
              <UBadge v-for="m in t.members" :key="m" color="neutral" variant="soft" size="sm">
                {{ m }}
              </UBadge>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <!-- devs -->
    <section id="devs" class="flex flex-col gap-3 scroll-mt-16">
      <div class="flex items-center gap-2">
        <h2 class="font-medium">
          Devs
        </h2>
        <UBadge color="neutral" variant="subtle" size="sm">
          {{ devs.length }}
        </UBadge>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <UCard v-for="d in devs" :key="d.name">
          <div class="flex flex-col gap-2">
            <div class="flex items-start gap-2">
              <div class="min-w-0">
                <div class="font-medium truncate">
                  {{ d.name }}
                  <UBadge v-if="d.bot" color="warning" variant="subtle" size="xs" class="ml-1">
                    bot
                  </UBadge>
                </div>
                <div v-if="profiles[d.name]?.title || d.title" class="text-xs text-primary truncate">
                  {{ profiles[d.name]?.title || d.title }}
                </div>
                <div v-if="profiles[d.name]?.description || d.description" class="text-xs text-dimmed line-clamp-2">
                  {{ profiles[d.name]?.description || d.description }}
                </div>
              </div>
              <UButton
                v-if="isDev && configLoaded"
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="xs"
                class="ml-auto shrink-0"
                aria-label="editar perfil"
                @click="openEdit(d.name)"
              />
            </div>
            <div class="flex flex-wrap gap-1">
              <UBadge
                v-for="t in d.teams"
                :key="t"
                variant="soft"
                size="xs"
                :style="teamColor(t) ? { backgroundColor: `${teamColor(t)}22`, color: teamColor(t)! } : {}"
              >
                {{ t }}
              </UBadge>
            </div>
            <div class="text-xs text-dimmed flex flex-col gap-0.5">
              <span v-if="d.githubLogins.length" class="truncate">
                <UIcon name="i-lucide-github" class="inline size-3 align-text-top" />
                {{ d.githubLogins.join(', ') }}
              </span>
              <span v-if="d.emails.length" class="truncate">
                <UIcon name="i-lucide-mail" class="inline size-3 align-text-top" />
                {{ d.emails.join(', ') }}
              </span>
            </div>
          </div>
        </UCard>
      </div>
    </section>

    <!-- candidatos -->
    <section v-if="candidates.length" id="sem-mapeamento" class="flex flex-col gap-3 scroll-mt-16">
      <div class="flex items-center gap-2">
        <h2 class="font-medium">
          Sem mapeamento
        </h2>
        <UBadge color="warning" variant="subtle" size="sm">
          {{ candidates.length }}
        </UBadge>
      </div>
      <p class="text-sm text-dimmed">
        Identidades vistas nos dados sem alias cadastrado. Associe a um dev existente pra unificar.
      </p>
      <div class="flex flex-col gap-2">
        <div
          v-for="c in candidates"
          :key="`${c.kind}:${c.id}`"
          class="flex items-center gap-2 flex-wrap rounded-lg border border-warning/30 bg-warning/5 px-3 py-2"
        >
          <UIcon :name="c.kind === 'login' ? 'i-lucide-github' : 'i-lucide-git-commit-horizontal'" class="size-4 text-warning shrink-0" />
          <div class="min-w-0 flex-1">
            <span class="font-mono text-sm">{{ c.id }}</span>
            <span v-if="c.emails?.length" class="text-xs text-dimmed ml-2">{{ c.emails.join(', ') }}</span>
            <span v-if="c.prs != null" class="text-xs text-dimmed ml-2">{{ c.prs }} PRs/reviews</span>
          </div>
          <template v-if="isDev && configLoaded">
            <USelectMenu
              v-model="assignTarget[c.id]"
              :items="devNames"
              placeholder="associar a…"
              size="xs"
              class="w-48"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              :disabled="!assignTarget[c.id]"
              label="associar"
              @click="c.kind === 'login' ? assignLogin(assignTarget[c.id], c.id) : assignEmails(assignTarget[c.id], c.emails ?? [])"
            />
          </template>
        </div>
      </div>
    </section>

    <!-- modal editar perfil -->
    <UModal :open="editing != null" :title="`perfil de ${editing ?? ''}`" @update:open="(v: boolean) => { if (!v) editing = null }">
      <template #body>
        <div class="flex flex-col gap-3">
          <UFormField label="título / cargo">
            <UInput v-model="draft.title" placeholder="ex.: Tech lead, Frontend, DevOps…" class="w-full" />
          </UFormField>
          <UFormField label="descrição">
            <UTextarea v-model="draft.description" placeholder="foco, squad, observações…" :rows="2" class="w-full" />
          </UFormField>
          <UFormField label="e-mails de commit" description="separados por vírgula — unifica nomes diferentes do mesmo dev no git">
            <UTextarea v-model="draft.emails" placeholder="a@b.com, c@d.com" :rows="2" class="w-full font-mono text-xs" />
          </UFormField>
          <UFormField label="logins do GitHub" description="separados por vírgula — unifica logins do mesmo dev em PRs">
            <UTextarea v-model="draft.githubLogins" placeholder="login1, login2" :rows="2" class="w-full font-mono text-xs" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="cancelar" color="neutral" variant="ghost" size="sm" @click="editing = null" />
          <UButton label="aplicar" size="sm" @click="confirmEdit" />
        </div>
      </template>
    </UModal>

    <!-- modal importar do GitHub -->
    <UModal v-model:open="showImport" title="importar do GitHub">
      <template #body>
        <div v-if="ghLoading" class="flex items-center gap-2 text-sm text-dimmed">
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
          buscando org…
        </div>
        <UAlert v-else-if="ghError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="ghError" />
        <div v-else-if="gh" class="flex flex-col gap-4">
          <UAlert
            v-if="gh.warnings?.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="gh.warnings.join(' · ')"
          />
          <div>
            <h3 class="text-sm font-medium mb-2">
              Times da org {{ gh.org }}
            </h3>
            <p v-if="!gh.teams.length" class="text-xs text-dimmed">
              Nenhum time visível (o token precisa de read:org).
            </p>
            <div class="flex flex-col gap-2">
              <div
                v-for="t in gh.teams"
                :key="t.slug"
                class="flex items-center gap-2 rounded-lg border border-default px-3 py-2"
              >
                <div class="min-w-0 flex-1">
                  <span class="text-sm font-medium">{{ t.name }}</span>
                  <span class="text-xs text-dimmed ml-2">{{ t.members.length }} membros</span>
                  <div v-if="t.description" class="text-xs text-dimmed truncate">
                    {{ t.description }}
                  </div>
                </div>
                <UButton size="xs" color="neutral" variant="soft" label="importar" @click="importTeam(t)" />
              </div>
            </div>
          </div>
          <div>
            <h3 class="text-sm font-medium mb-2">
              Membros sem mapeamento ({{ unmappedGhMembers.length }})
            </h3>
            <p v-if="!unmappedGhMembers.length" class="text-xs text-dimmed">
              Todos os membros da org já estão mapeados.
            </p>
            <div class="flex flex-col gap-2">
              <div
                v-for="m in unmappedGhMembers"
                :key="m.login"
                class="flex items-center gap-2 rounded-lg border border-default px-3 py-2"
              >
                <UAvatar :src="m.avatar_url" :alt="m.login" size="xs" />
                <span class="font-mono text-sm flex-1 truncate">{{ m.login }}</span>
                <USelectMenu v-model="assignTarget[m.login]" :items="devNames" placeholder="associar a…" size="xs" class="w-44" />
                <UButton
                  size="xs"
                  color="neutral"
                  variant="soft"
                  :disabled="!assignTarget[m.login]"
                  label="associar"
                  @click="assignLogin(assignTarget[m.login], m.login)"
                />
              </div>
            </div>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
