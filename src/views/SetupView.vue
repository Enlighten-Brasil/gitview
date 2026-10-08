<script setup lang="ts">
/**
 * Configuração/onboarding pela UI (apenas dev — os endpoints /__setup e
 * /__auth são middlewares do Vite).
 *
 * Dois modos:
 * - primeira execução (sem dados): wizard de 3 passos — conectar GitHub,
 *   escolher repositórios, clonar e coletar;
 * - já configurado (hasData): tela de Configurações — repos atuais com opção
 *   de gerenciar (adicionar/remover), manutenção dos dados e conta GitHub,
 *   sem o wizard na frente.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { collectError, collectLog, collectSucceeded, collecting, startCollect } from '../collect'
import type { DeviceFlowStart, OrgEntry, RepoEntry, SetupStatus } from '../setup'
import {
  fetchOrgs,
  fetchRepos,
  fetchSetupStatus,
  pollDeviceFlow,
  setupApplying,
  setupDone,
  setupError,
  setupLog,
  startDeviceFlow,
  startSetupApply,
} from '../setup'

const router = useRouter()
const isDev = import.meta.env.DEV

// máquina de estados da página:
//   wizard (sem dados):    auth → repos → run
//   já configurado:        settings → repos → run  (ou settings → auth → settings p/ trocar conta)
type View = 'settings' | 'auth' | 'repos' | 'run'
const view = ref<View>('auth')
// true quando o fluxo atual partiu da tela de configurações (gerenciar/trocar conta)
const cameFromSettings = ref(false)

const wizardStep = computed(() => (view.value === 'auth' ? 1 : view.value === 'repos' ? 2 : 3))
const wizardLabel = computed(() => ['conectar o GitHub', 'escolher repositórios', 'clonar e coletar'][wizardStep.value - 1])

const pageTitle = computed(() => {
  if (view.value === 'settings')
    return 'Configurações'
  if (cameFromSettings.value)
    return view.value === 'auth' ? 'Configurações — conta GitHub' : 'Configurações — gerenciar repositórios'
  return 'Configurar gitview'
})
const pageSubtitle = computed(() => {
  if (view.value === 'settings' || cameFromSettings.value)
    return null
  return `passo ${wizardStep.value} de 3 — ${wizardLabel.value}`
})

// ---------------------------------------------------------------------------
// status + auth
// ---------------------------------------------------------------------------
const status = ref<SetupStatus | null>(null)
const statusError = ref<string | null>(null)
const loadingStatus = ref(false)
let viewInitialized = false
// login quando entrou na tela de auth vindo das configurações (detecta a troca)
let authLoginOnEntry: string | null = null

async function refreshStatus(silent = false) {
  if (!silent)
    loadingStatus.value = true
  statusError.value = null
  try {
    status.value = await fetchSetupStatus()
    // primeira carga: com dados cai direto nas configurações; sem dados abre o wizard
    if (!viewInitialized) {
      viewInitialized = true
      view.value = status.value.hasData ? 'settings' : 'auth'
    }
    // troca de conta concluída (login mudou): volta às configurações
    else if (view.value === 'auth' && cameFromSettings.value && status.value.auth && status.value.auth.login !== authLoginOnEntry) {
      cameFromSettings.value = false
      view.value = 'settings'
    }
  }
  catch (err) {
    statusError.value = (err as Error).message
  }
  finally {
    loadingStatus.value = false
  }
}

// sonda de auth: detecta `gh auth login` / troca de conta feita fora da página
let statusTimer: number | null = null
onMounted(() => {
  refreshStatus()
  statusTimer = window.setInterval(() => {
    if (view.value === 'auth' && !device.value)
      refreshStatus(true)
  }, 5000)
})

const device = ref<DeviceFlowStart | null>(null)
const deviceError = ref<string | null>(null)
let pollTimer: number | null = null

async function beginDeviceFlow() {
  deviceError.value = null
  try {
    device.value = await startDeviceFlow()
    schedulePoll(device.value.interval)
  }
  catch (err) {
    deviceError.value = (err as Error).message
  }
}

function schedulePoll(seconds: number) {
  pollTimer = window.setTimeout(async () => {
    if (!device.value)
      return
    try {
      const r = await pollDeviceFlow(device.value.deviceCode)
      if (r.status === 'ok') {
        device.value = null
        await refreshStatus()
        return
      }
      if (r.status === 'pending')
        schedulePoll(device.value.interval)
      else if (r.status === 'slow_down')
        schedulePoll(device.value.interval + 5)
      else {
        deviceError.value = r.status === 'denied' ? 'autorização negada no GitHub' : 'código expirado — tente de novo'
        device.value = null
      }
    }
    catch (err) {
      deviceError.value = (err as Error).message
      device.value = null
    }
  }, seconds * 1000)
}

onBeforeUnmount(() => {
  if (pollTimer)
    clearTimeout(pollTimer)
  if (statusTimer)
    clearInterval(statusTimer)
})

function openAuth(fromSettings: boolean) {
  cameFromSettings.value = fromSettings
  authLoginOnEntry = fromSettings ? (status.value?.auth?.login ?? null) : null
  view.value = 'auth'
}

/** desiste do device flow em andamento e volta às configurações */
function cancelDeviceAndGoBack() {
  device.value = null
  if (pollTimer)
    clearTimeout(pollTimer)
  view.value = 'settings'
}

/** auth ok → wizard segue pros repos; troca de conta volta às configurações */
function continueFromAuth() {
  if (cameFromSettings.value)
    view.value = 'settings'
  else openRepos(false)
}

// ---------------------------------------------------------------------------
// escolha de repos (wizard e gerenciamento)
// ---------------------------------------------------------------------------
const orgs = ref<OrgEntry[]>([])
const selectedOrg = ref<string | null>(null)
const orgItems = computed(() => orgs.value.map(o => ({
  label: o.personal ? `${o.login} (pessoal)` : o.login,
  value: o.personal ? '@user' : o.login,
})))

const repos = ref<RepoEntry[]>([])
const loadingRepos = ref(false)
const reposError = ref<string | null>(null)
const checked = ref<string[]>([])
const search = ref('')

const filteredRepos = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? repos.value.filter(r => r.name.toLowerCase().includes(q)) : repos.value
})

/** seleção inicial do modo gerenciar — base pra detectar o que foi desmarcado */
const initialChecked = ref<string[]>([])
/** repos atuais que o usuário desmarcou (serão removidos do disco) */
const removed = computed(() => initialChecked.value.filter(n => !checked.value.includes(n)))

function precheck(list: RepoEntry[]) {
  const names = list.map(r => r.name)
  if (cameFromSettings.value) {
    // gerenciamento: pré-seleciona os repos que já estão no dashboard
    const current = new Set(status.value?.repos ?? [])
    const sel = names.filter(n => current.has(n))
    checked.value = sel
    initialChecked.value = [...sel]
    return
  }
  // wizard: pré-seleciona o padrão do time (ou tudo que não está arquivado)
  const defaults = (status.value?.defaultRepos ?? []).map(n => n.toLowerCase())
  const inDefaults = names.filter(n => defaults.includes(n.toLowerCase()))
  checked.value = inDefaults.length ? inDefaults : list.filter(r => !r.archived).map(r => r.name)
  initialChecked.value = []
}

async function loadRepos(org: string) {
  loadingRepos.value = true
  reposError.value = null
  repos.value = []
  try {
    const list = await fetchRepos(org)
    repos.value = list
    precheck(list)
  }
  catch (err) {
    reposError.value = (err as Error).message
  }
  finally {
    loadingRepos.value = false
  }
}

async function openRepos(fromSettings: boolean) {
  cameFromSettings.value = fromSettings
  view.value = 'repos'
  if (orgs.value.length) {
    // org/repos já carregados de um fluxo anterior: refaz a pré-seleção do modo atual
    if (repos.value.length)
      precheck(repos.value)
    return
  }
  try {
    orgs.value = await fetchOrgs()
    const defaultOrg = status.value?.defaultOrg
    selectedOrg.value = orgItems.value.find(o => o.value === defaultOrg)?.value ?? orgItems.value[0]?.value ?? null
  }
  catch (err) {
    reposError.value = (err as Error).message
  }
}

watch(selectedOrg, (org) => {
  if (org)
    loadRepos(org)
})

function toggle(name: string, on: boolean) {
  checked.value = on ? [...checked.value, name] : checked.value.filter(n => n !== name)
}

/** seleção rápida: padrão do time (config.defaultRepos), caindo pra tudo não-arquivado */
function applyTimeDefault() {
  const defaults = (status.value?.defaultRepos ?? []).map(n => n.toLowerCase())
  const sel = repos.value.filter(r => defaults.includes(r.name.toLowerCase())).map(r => r.name)
  checked.value = sel.length ? sel : repos.value.filter(r => !r.archived).map(r => r.name)
}

function backFromRepos() {
  view.value = cameFromSettings.value ? 'settings' : 'auth'
}

// ---------------------------------------------------------------------------
// execução (clone + coleta)
// ---------------------------------------------------------------------------
const allDone = ref(false)
const running = computed(() => setupApplying.value || collecting.value)

const runPhase = computed<'clone' | 'collect' | 'done' | 'error' | 'idle'>(() => {
  if (allDone.value)
    return 'done'
  if (setupError.value || collectError.value)
    return 'error'
  if (setupApplying.value)
    return 'clone'
  if (collecting.value)
    return 'collect'
  return 'idle'
})
const runTitle = computed(() => {
  switch (runPhase.value) {
    case 'clone': return 'Clonando repositórios…'
    case 'collect': return 'Coletando dados…'
    case 'done': return 'Tudo pronto!'
    case 'error': return 'Algo deu errado'
    default: return cameFromSettings.value ? 'Aplicando mudanças…' : 'Clonar e coletar'
  }
})

function run() {
  view.value = 'run'
  allDone.value = false
  const org = selectedOrg.value === '@user' ? (status.value?.auth?.login ?? '') : (selectedOrg.value ?? '')
  startSetupApply(org, checked.value, { remove: removed.value })
}

// clone terminou → dispara a coleta (reusa o fluxo do botão ↻ do navbar)
watch(setupDone, (done) => {
  if (done && view.value === 'run')
    startCollect()
})
watch(collectSucceeded, (ok) => {
  if (ok && view.value === 'run') {
    allDone.value = true
    refreshStatus()
  }
})

function backFromRun() {
  view.value = cameFromSettings.value ? 'settings' : 'repos'
}

// ---------------------------------------------------------------------------
// manutenção: recoletar tudo / limpar dados locais (banco + JSONs regeneráveis)
// ---------------------------------------------------------------------------
const confirmWipe = ref(false)
const maintenanceRan = ref(false)
const maintenanceLog = computed(() => collectLog.value.slice(-8))

function recollectAll() {
  confirmWipe.value = false
  maintenanceRan.value = true
  startCollect(true)
}

function wipeAndRecollect() {
  if (!confirmWipe.value) {
    confirmWipe.value = true
    return
  }
  confirmWipe.value = false
  maintenanceRan.value = true
  startCollect(false, true)
}
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-8">
    <div>
      <h1 class="text-2xl font-bold">
        {{ pageTitle }}
      </h1>
      <p v-if="pageSubtitle" class="text-sm text-dimmed">
        {{ pageSubtitle }}
      </p>
    </div>

    <UAlert
      v-if="!isDev"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Setup disponível apenas em modo dev"
      description="Os endpoints de configuração só existem no dev server (pnpm dev). No build estático o dashboard é somente leitura."
    />

    <template v-else>
      <!-- ================================================================ -->
      <!-- tela de configurações (já tem dados)                              -->
      <!-- ================================================================ -->
      <template v-if="view === 'settings'">
        <UCard>
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2 font-medium">
              <UIcon name="i-lucide-package" class="size-5" />
              Repositórios no dashboard
              <UBadge color="neutral" variant="subtle" size="sm" class="ml-auto">
                {{ status?.repos.length ?? 0 }}
              </UBadge>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <UBadge
                v-for="r in status?.repos ?? []"
                :key="r"
                color="neutral"
                variant="soft"
                size="sm"
              >
                {{ r }}
              </UBadge>
            </div>
            <div class="flex justify-end">
              <UButton
                label="gerenciar repositórios"
                icon="i-lucide-list-checks"
                trailing-icon="i-lucide-arrow-right"
                color="neutral"
                variant="outline"
                @click="openRepos(true)"
              />
            </div>
          </div>
        </UCard>

        <!-- manutenção dos dados locais (banco + JSONs são 100% regeneráveis) -->
        <UCard>
          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-2 font-medium">
              <UIcon name="i-lucide-database" class="size-5" />
              Manutenção dos dados locais
            </div>
            <p class="text-sm text-dimmed">
              O banco e os JSONs do dashboard são regenerados a partir dos repositórios.
              Recoletar tudo refaz o scan completo; limpar apaga banco + JSONs antes da
              recoleta (os clones em <code>data/repos</code> são mantidos).
            </p>

            <pre
              v-if="collecting && maintenanceLog.length"
              class="max-h-40 overflow-auto rounded bg-accented p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap"
            >{{ maintenanceLog.join('\n') }}</pre>

            <UAlert
              v-if="maintenanceRan && collectSucceeded && !collecting"
              color="success"
              variant="subtle"
              icon="i-lucide-circle-check"
              title="dados regenerados com sucesso"
            />
            <UAlert
              v-if="maintenanceRan && collectError"
              color="error"
              variant="subtle"
              icon="i-lucide-circle-x"
              :title="collectError"
            />

            <div class="flex items-center justify-between">
              <UButton
                label="recoletar tudo"
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="outline"
                :disabled="collecting"
                @click="recollectAll"
              />
              <div class="flex items-center gap-2">
                <template v-if="confirmWipe">
                  <span class="text-xs text-dimmed">apaga banco + JSONs (regenerados na sequência)</span>
                  <UButton label="cancelar" size="sm" color="neutral" variant="ghost" @click="confirmWipe = false" />
                  <UButton
                    label="confirmar limpeza"
                    size="sm"
                    color="error"
                    icon="i-lucide-trash-2"
                    :loading="collecting"
                    @click="wipeAndRecollect"
                  />
                </template>
                <UButton
                  v-else
                  label="limpar e recomeçar"
                  color="error"
                  variant="soft"
                  icon="i-lucide-trash-2"
                  :disabled="collecting"
                  @click="wipeAndRecollect"
                />
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-github" class="size-5" />
            <template v-if="status?.auth">
              <span class="text-sm">
                Conectado como <span class="font-medium">@{{ status.auth.login }}</span>
                <span class="text-dimmed">via {{ status.auth.via }}</span>
              </span>
              <UButton
                v-if="status.oauthConfigured"
                label="trocar de conta"
                size="xs"
                color="neutral"
                variant="link"
                class="ml-auto"
                @click="openAuth(true)"
              />
            </template>
            <template v-else>
              <span class="text-sm text-dimmed">GitHub não conectado — necessário pra gerenciar e coletar.</span>
              <UButton
                label="conectar"
                size="sm"
                class="ml-auto"
                @click="openAuth(true)"
              />
            </template>
          </div>
        </UCard>
      </template>

      <!-- ================================================================ -->
      <!-- auth (passo 1 do wizard / troca de conta)                         -->
      <!-- ================================================================ -->
      <UCard v-else-if="view === 'auth'">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-github" class="size-5" />
            Conectar sua conta do GitHub
          </div>

          <UAlert v-if="statusError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="statusError" />

          <div v-if="loadingStatus" class="flex items-center gap-2 text-sm text-dimmed">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
            verificando autenticação…
          </div>

          <!-- com device flow em andamento, cai no bloco abaixo pra mostrar o código -->
          <template v-else-if="status?.auth && !device">
            <UAlert
              color="success"
              variant="subtle"
              icon="i-lucide-circle-check"
              :title="`Conectado como @${status.auth.login}`"
              :description="`via ${status.auth.via}. Os repos são listados e clonados com as suas permissões.`"
            />
            <p v-if="!status.oauthConfigured" class="text-xs text-dimmed">
              Para trocar de conta, rode `gh auth login` no terminal — a troca é detectada aqui automaticamente.
            </p>
            <div class="flex justify-between">
              <UButton
                v-if="cameFromSettings"
                label="voltar"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="view = 'settings'"
              />
              <UButton
                v-else-if="status.oauthConfigured"
                label="trocar de conta"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="beginDeviceFlow"
              />
              <span v-else />
              <UButton
                v-if="cameFromSettings && status.oauthConfigured"
                label="trocar de conta"
                icon="i-lucide-github"
                @click="beginDeviceFlow"
              />
              <UButton
                v-else-if="!cameFromSettings"
                label="continuar"
                trailing-icon="i-lucide-arrow-right"
                @click="continueFromAuth"
              />
            </div>
          </template>

          <template v-else>
            <!-- device flow (OAuth App configurado) -->
            <template v-if="status?.oauthConfigured">
              <div v-if="device" class="flex flex-col items-center gap-3 rounded-lg bg-accented p-4">
                <p class="text-sm">
                  1. Abra
                  <a :href="device.verificationUri" target="_blank" class="font-medium text-primary underline">{{ device.verificationUri }}</a>
                </p>
                <p class="text-sm">
                  2. Digite o código:
                </p>
                <p class="font-mono text-3xl font-bold tracking-[0.3em]">
                  {{ device.userCode }}
                </p>
                <p class="flex items-center gap-2 text-xs text-dimmed">
                  <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" />
                  aguardando autorização…
                </p>
              </div>
              <UAlert v-if="deviceError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="deviceError" />
              <div class="flex justify-between gap-2">
                <UButton
                  v-if="cameFromSettings"
                  label="voltar"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="cancelDeviceAndGoBack"
                />
                <span v-else />
                <UButton
                  v-if="!device"
                  label="Conectar com GitHub"
                  icon="i-lucide-github"
                  @click="beginDeviceFlow"
                />
              </div>
            </template>

            <!-- ponte gh CLI (sem OAuth App configurado) -->
            <template v-else>
              <UAlert
                color="info"
                variant="subtle"
                icon="i-lucide-terminal"
                title="Autentique com o GitHub CLI"
                description="Rode `gh auth login` no terminal (uma vez só) e clique em verificar. Quando um OAuth App for configurado neste projeto, este passo vira um botão."
              />
              <div class="flex justify-between gap-2">
                <UButton
                  v-if="cameFromSettings"
                  label="voltar"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="view = 'settings'"
                />
                <span v-else />
                <UButton
                  label="verificar novamente"
                  icon="i-lucide-refresh-cw"
                  color="neutral"
                  variant="outline"
                  :loading="loadingStatus"
                  @click="refreshStatus"
                />
              </div>
            </template>
          </template>
        </div>
      </UCard>

      <!-- ================================================================ -->
      <!-- escolha de repos (passo 2 do wizard / gerenciamento)              -->
      <!-- ================================================================ -->
      <UCard v-else-if="view === 'repos'">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-package" class="size-5" />
            {{ cameFromSettings ? 'Gerenciar repositórios' : 'Quais repositórios entram no dashboard?' }}
          </div>

          <USelectMenu
            v-model="selectedOrg"
            :items="orgItems"
            value-key="value"
            placeholder="organização"
            class="w-full"
          />

          <UInput v-model="search" icon="i-lucide-search" placeholder="filtrar repositórios…" />

          <UAlert v-if="reposError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="reposError" />
          <div v-if="loadingRepos" class="flex items-center gap-2 text-sm text-dimmed">
            <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
            listando repositórios…
          </div>

          <div v-else class="max-h-72 overflow-auto rounded-lg border border-default">
            <label
              v-for="r in filteredRepos"
              :key="r.name"
              class="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-accented"
              :class="r.archived && 'opacity-50'"
            >
              <UCheckbox
                :model-value="checked.includes(r.name)"
                :disabled="r.archived"
                @update:model-value="toggle(r.name, $event === true)"
              />
              <span class="flex-1">{{ r.name }}</span>
              <UBadge v-if="cameFromSettings && status?.repos.includes(r.name)" color="primary" variant="soft" size="sm">
                atual
              </UBadge>
              <UBadge v-if="r.archived" color="neutral" variant="soft" size="sm">
                arquivado
              </UBadge>
            </label>
            <p v-if="!filteredRepos.length" class="px-3 py-2 text-sm text-dimmed">
              nenhum repo encontrado
            </p>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1 text-xs text-dimmed">
              <span>{{ checked.length }} de {{ repos.length }} selecionados</span>
              <UButton label="padrão do time" size="xs" color="neutral" variant="link" @click="applyTimeDefault" />
              <UButton
                label="todos"
                size="xs"
                color="neutral"
                variant="link"
                @click="checked = repos.filter(r => !r.archived).map(r => r.name)"
              />
              <UButton label="nenhum" size="xs" color="neutral" variant="link" @click="checked = []" />
            </div>
          </div>

          <UAlert
            v-if="removed.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="`${removed.length} repo(s) serão removidos do disco: ${removed.join(', ')}`"
            description="Os dados deles saem do dashboard na próxima coleta. Para manter, deixe marcado."
          />

          <div class="flex justify-between">
            <UButton label="voltar" color="neutral" variant="ghost" size="sm" @click="backFromRepos" />
            <UButton
              :label="cameFromSettings ? 'aplicar mudanças' : 'clonar e coletar'"
              trailing-icon="i-lucide-arrow-right"
              :disabled="!checked.length"
              @click="run"
            />
          </div>
        </div>
      </UCard>

      <!-- ================================================================ -->
      <!-- execução (passo 3 do wizard / aplicar mudanças)                   -->
      <!-- ================================================================ -->
      <UCard v-else>
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 font-medium">
            <UIcon
              :name="runPhase === 'done' ? 'i-lucide-circle-check' : runPhase === 'error' ? 'i-lucide-circle-x' : running ? 'i-lucide-loader-circle' : 'i-lucide-package-open'"
              :class="[running && 'animate-spin', runPhase === 'done' && 'text-success', runPhase === 'error' && 'text-error']"
              class="size-5"
            />
            {{ runTitle }}
          </div>

          <details v-if="setupLog.length || collectLog.length" class="rounded-lg border border-default" :open="runPhase === 'error'">
            <summary class="cursor-pointer px-3 py-2 text-xs text-dimmed select-none">
              detalhes da execução
            </summary>
            <pre class="max-h-64 overflow-auto px-3 pb-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{{ [...setupLog, ...collectLog].join('\n') }}</pre>
          </details>

          <UAlert v-if="setupError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="setupError" />
          <UAlert v-else-if="collectError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="collectError" />

          <div class="flex justify-between">
            <UButton
              v-if="!running && runPhase !== 'done'"
              label="voltar"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="backFromRun"
            />
            <UButton
              v-else-if="runPhase === 'done' && cameFromSettings"
              label="voltar às configurações"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="view = 'settings'"
            />
            <span v-else />
            <UButton
              v-if="runPhase === 'done'"
              label="abrir dashboard"
              trailing-icon="i-lucide-arrow-right"
              @click="router.push('/')"
            />
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
