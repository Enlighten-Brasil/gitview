<script setup lang="ts">
/**
 * Onboarding/configuração pela UI (apenas dev — os endpoints /__setup e
 * /__auth são middlewares do Vite). 3 passos: conectar GitHub (device flow
 * ou ponte gh), escolher org + repos, clonar e rodar a primeira coleta.
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

const step = ref(1)
const stepLabel = computed(() => ['conectar o GitHub', 'escolher repositórios', 'clonar e coletar'][step.value - 1])

// ---------------------------------------------------------------------------
// passo 1: auth
// ---------------------------------------------------------------------------
const status = ref<SetupStatus | null>(null)
const statusError = ref<string | null>(null)
const loadingStatus = ref(false)

async function refreshStatus() {
  loadingStatus.value = true
  statusError.value = null
  try {
    status.value = await fetchSetupStatus()
  }
  catch (err) {
    statusError.value = (err as Error).message
  }
  finally {
    loadingStatus.value = false
  }
}
onMounted(refreshStatus)

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
    if (!device.value) return
    try {
      const r = await pollDeviceFlow(device.value.deviceCode)
      if (r.status === 'ok') {
        device.value = null
        await refreshStatus()
        return
      }
      if (r.status === 'pending') schedulePoll(device.value.interval)
      else if (r.status === 'slow_down') schedulePoll(device.value.interval + 5)
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
  if (pollTimer) clearTimeout(pollTimer)
})

// ---------------------------------------------------------------------------
// passo 2: org + repos
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

function precheck(list: RepoEntry[]) {
  const defaults = (status.value?.defaultRepos ?? []).map(n => n.toLowerCase())
  const names = list.map(r => r.name)
  const inDefaults = names.filter(n => defaults.includes(n.toLowerCase()))
  checked.value = inDefaults.length ? inDefaults : list.filter(r => !r.archived).map(r => r.name)
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

async function goToRepos() {
  step.value = 2
  if (orgs.value.length) return
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
  if (org) loadRepos(org)
})

function toggle(name: string, on: boolean) {
  checked.value = on ? [...checked.value, name] : checked.value.filter(n => n !== name)
}

// ---------------------------------------------------------------------------
// passo 3: clone + coleta
// ---------------------------------------------------------------------------
const allDone = ref(false)
const running = computed(() => setupApplying.value || collecting.value)

function run() {
  step.value = 3
  allDone.value = false
  startSetupApply(selectedOrg.value === '@user' ? (status.value?.auth?.login ?? '') : (selectedOrg.value ?? ''), checked.value)
}

// clone terminou → dispara a coleta (reusa o fluxo do botão ↻ do navbar)
watch(setupDone, (done) => {
  if (done && step.value === 3) startCollect()
})
watch(collectSucceeded, (ok) => {
  if (ok && step.value === 3) allDone.value = true
})
</script>

<template>
  <div class="mx-auto flex max-w-2xl flex-col gap-6 p-8">
    <div>
      <h1 class="text-2xl font-bold">
        Configurar gitview
      </h1>
      <p class="text-sm text-dimmed">
        passo {{ step }} de 3 — {{ stepLabel }}
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
      <!-- passo 1: conectar GitHub -->
      <UCard v-if="step === 1">
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

          <template v-else-if="status?.auth">
            <UAlert
              color="success"
              variant="subtle"
              icon="i-lucide-circle-check"
              :title="`Conectado como @${status.auth.login}`"
              :description="`via ${status.auth.via}. Os repos são listados e clonados com as suas permissões.`"
            />
            <div class="flex justify-between">
              <UButton
                v-if="status.oauthConfigured"
                label="trocar de conta"
                color="neutral"
                variant="ghost"
                size="sm"
                @click="beginDeviceFlow"
              />
              <span v-else />
              <UButton label="continuar" trailing-icon="i-lucide-arrow-right" @click="goToRepos" />
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
              <UButton
                v-if="!device"
                label="Conectar com GitHub"
                icon="i-lucide-github"
                block
                @click="beginDeviceFlow"
              />
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
              <UButton
                label="verificar novamente"
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="outline"
                block
                :loading="loadingStatus"
                @click="refreshStatus"
              />
            </template>
          </template>
        </div>
      </UCard>

      <!-- passo 2: escolher repos -->
      <UCard v-else-if="step === 2">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 font-medium">
            <UIcon name="i-lucide-package" class="size-5" />
            Quais repositórios entram no dashboard?
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
              <UBadge v-if="r.archived" color="neutral" variant="soft" size="sm">arquivado</UBadge>
            </label>
            <p v-if="!filteredRepos.length" class="px-3 py-2 text-sm text-dimmed">
              nenhum repo encontrado
            </p>
          </div>

          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1 text-xs text-dimmed">
              <span>{{ checked.length }} de {{ repos.length }} selecionados</span>
              <UButton label="padrão do time" size="xs" color="neutral" variant="link" @click="precheck(repos)" />
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

          <div class="flex justify-between">
            <UButton label="voltar" color="neutral" variant="ghost" size="sm" @click="step = 1" />
            <UButton
              label="clonar e coletar"
              trailing-icon="i-lucide-arrow-right"
              :disabled="!checked.length"
              @click="run"
            />
          </div>
        </div>
      </UCard>

      <!-- passo 3: executar -->
      <UCard v-else>
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 font-medium">
            <UIcon
              :name="allDone ? 'i-lucide-circle-check' : running ? 'i-lucide-loader-circle' : 'i-lucide-package-open'"
              :class="[running && 'animate-spin', allDone && 'text-success']"
              class="size-5"
            />
            {{ allDone ? 'Tudo pronto!' : running ? 'Trabalhando…' : 'Clonar e coletar' }}
          </div>

          <pre
            v-if="setupLog.length || collectLog.length"
            class="max-h-72 overflow-auto rounded bg-accented p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap"
          >{{ [...setupLog, ...collectLog].join('\n') }}</pre>

          <UAlert v-if="setupError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="setupError" />
          <UAlert v-else-if="collectError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="collectError" />

          <div class="flex justify-between">
            <UButton
              v-if="!running"
              label="voltar"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="step = 2"
            />
            <span v-else />
            <UButton
              v-if="allDone"
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
