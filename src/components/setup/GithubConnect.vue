<script setup lang="ts">
import type { DeviceFlowStart, SetupStatus } from '@/setup'
/**
 * Conexão com o GitHub — os três caminhos: device flow (Client ID no .env),
 * PAT colado (sempre disponível) e ponte do `gh auth login` (auto-detecção).
 * O polling do device flow e a sonda de auth vivem aqui e são limpos no unmount.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { githubLogout, pollDeviceFlow, startDeviceFlow, submitGithubToken } from '@/setup'

const props = defineProps<{
  status: SetupStatus | null
  loading?: boolean
  error?: string | null
  /** wizard: mostra "continuar"; settings: mostra "trocar de conta"/"desconectar" */
  mode?: 'wizard' | 'settings'
}>()
const emit = defineEmits<{
  /** 'reload': recarrega com spinner (ação do usuário); 'poll': silencioso */
  refresh: [mode?: 'reload' | 'poll']
  /** wizard: auth ok, seguir para o próximo passo */
  continue: []
}>()

const mode = computed(() => props.mode ?? 'wizard')
const auth = computed(() => props.status?.auth ?? null)
const oauthConfigured = computed(() => props.status?.oauthConfigured ?? false)

// ---------------------------------------------------------------------------
// device flow
// ---------------------------------------------------------------------------
const device = ref<DeviceFlowStart | null>(null)
const deviceError = ref<string | null>(null)
let pollTimer: number | null = null
// AbortController do poll em voo — abortado no cancel/desmontagem
let pollAbort: AbortController | null = null
// flag de vida: impede reagendamento depois do unmount (await em voo)
let disposed = false

async function beginDeviceFlow() {
  deviceError.value = null
  try {
    const start = await startDeviceFlow()
    // componente desmontado durante o await: não iniciar polling fantasma
    if (disposed)
      return
    device.value = start
    schedulePoll(start.interval)
  }
  catch (err) {
    if (!disposed)
      deviceError.value = (err as Error).message
  }
}

function schedulePoll(seconds: number) {
  pollTimer = window.setTimeout(async () => {
    const current = device.value
    if (!current || disposed)
      return
    pollAbort = new AbortController()
    try {
      const r = await pollDeviceFlow(current.deviceCode, pollAbort.signal)
      // fluxo cancelado/desmontado durante o await: nunca reagendar
      if (disposed || device.value !== current)
        return
      if (r.status === 'ok') {
        device.value = null
        emit('refresh', 'reload')
        return
      }
      if (r.status === 'pending') {
        schedulePoll(current.interval)
      }
      else if (r.status === 'slow_down') {
        schedulePoll(current.interval + 5)
      }
      else {
        deviceError.value = r.status === 'denied' ? 'autorização negada no GitHub' : 'código expirado — tente de novo'
        device.value = null
      }
    }
    catch (err) {
      // abort (cancel/desmontagem) não é erro de fluxo — só silenciar
      if (disposed || (err as Error).name === 'AbortError')
        return
      deviceError.value = (err as Error).message
      device.value = null
    }
    finally {
      pollAbort = null
    }
  }, seconds * 1000)
}

function cancelDeviceFlow() {
  device.value = null
  deviceError.value = null
  if (pollTimer) {
    clearTimeout(pollTimer)
    pollTimer = null
  }
  // aborta o poll em voo para o ciclo parar imediatamente
  pollAbort?.abort()
  pollAbort = null
}

// ---------------------------------------------------------------------------
// PAT colado + desconexão
// ---------------------------------------------------------------------------
const pat = ref('')
const patSaving = ref(false)
const patError = ref<string | null>(null)

async function connectPat() {
  if (!pat.value.trim() || patSaving.value)
    return
  patSaving.value = true
  patError.value = null
  try {
    await submitGithubToken(pat.value.trim())
    pat.value = ''
    emit('refresh', 'reload')
  }
  catch (err) {
    patError.value = (err as Error).message
  }
  finally {
    patSaving.value = false
  }
}

const loggingOut = ref(false)
const logoutError = ref<string | null>(null)

async function disconnectGithub() {
  loggingOut.value = true
  logoutError.value = null
  try {
    await githubLogout()
    emit('refresh', 'reload')
  }
  catch (err) {
    // falha no logout nunca vira unhandled rejection — sempre mostra na UI
    logoutError.value = (err as Error).message
  }
  finally {
    loggingOut.value = false
  }
}

// ---------------------------------------------------------------------------
// sonda: detecta `gh auth login` / troca de conta feita fora da página
// ---------------------------------------------------------------------------
let sonda: number | null = null

onMounted(() => {
  sonda = window.setInterval(() => {
    // silencioso: é assim que detecta `gh auth login` feito no terminal
    if (!device.value && !auth.value)
      emit('refresh', 'poll')
  }, 5000)
})

onBeforeUnmount(() => {
  disposed = true
  // limpeza completa: zera device + timer + aborta o poll em voo
  cancelDeviceFlow()
  if (sonda)
    clearInterval(sonda)
})
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2 font-medium">
        <UIcon name="i-lucide-github" class="size-5" />
        Conectar sua conta do GitHub
      </div>

      <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-circle-x" :title="error" />

      <div v-if="loading" class="flex items-center gap-2 text-sm text-dimmed">
        <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" />
        verificando autenticação…
      </div>

      <!-- conectado -->
      <template v-else-if="auth && !device">
        <UAlert
          color="success"
          variant="subtle"
          icon="i-lucide-circle-check"
          :title="`Conectado como @${auth.login}`"
          :description="`via ${auth.via}. Os repos são listados e clonados com as suas permissões.`"
        />
        <p v-if="!oauthConfigured && auth.via === 'gh cli'" class="text-xs text-dimmed">
          Para trocar de conta, rode `gh auth login` no terminal — a troca é detectada aqui automaticamente.
        </p>
        <UAlert v-if="logoutError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="`Falha ao desconectar: ${logoutError}`" />
        <div class="flex justify-between gap-2">
          <div class="flex items-center gap-2">
            <UButton
              v-if="oauthConfigured"
              label="trocar de conta"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="beginDeviceFlow"
            />
            <UButton
              v-if="auth.via === 'token (.env)'"
              label="desconectar"
              size="sm"
              color="error"
              variant="ghost"
              icon="i-lucide-log-out"
              :loading="loggingOut"
              @click="disconnectGithub"
            />
          </div>
          <UButton
            v-if="mode === 'wizard'"
            label="continuar"
            trailing-icon="i-lucide-arrow-right"
            @click="emit('continue')"
          />
        </div>
      </template>

      <!-- fluxo de conexão -->
      <template v-else>
        <!-- device flow (Client ID configurado no .env) -->
        <template v-if="oauthConfigured">
          <div v-if="device" class="flex flex-col items-center gap-3 rounded-lg bg-accented p-4">
            <p class="text-sm">
              1. Abra
              <a :href="device.verificationUri" target="_blank" rel="noopener noreferrer" class="font-medium text-primary underline">{{ device.verificationUri }}</a>
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
              v-if="device"
              label="cancelar"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="cancelDeviceFlow"
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

        <!-- ponte gh CLI (sem Client ID no .env) -->
        <template v-else>
          <UAlert
            color="info"
            variant="subtle"
            icon="i-lucide-terminal"
            title="Autentique com o GitHub CLI"
            description="Rode `gh auth login` no terminal (uma vez só) e clique em verificar — a sessão é detectada aqui automaticamente. Ou cole um token pessoal abaixo. Definindo GITVIEW_GITHUB_CLIENT_ID no .env, o botão de device flow aparece."
          />
          <UButton
            label="verificar novamente"
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :loading="loading"
            class="self-start"
            @click="emit('refresh', 'reload')"
          />
        </template>

        <!-- alternativa universal: colar um PAT (funciona sem OAuth App e sem gh) -->
        <USeparator label="ou" class="my-1" />
        <div class="flex flex-col gap-2">
          <span class="text-sm font-medium">
            Usar um token pessoal (PAT)
          </span>
          <p class="text-xs text-dimmed">
            GitHub → Settings → Developer settings → Personal access tokens (clássico), escopo <code>repo</code> (+ <code>read:org</code> p/ importar times). Fica só no <code>.env</code> da máquina.
          </p>
          <div class="flex gap-2">
            <UInput
              v-model="pat"
              type="password"
              placeholder="ghp_…"
              class="flex-1"
              @keyup.enter="connectPat"
            />
            <UButton
              label="conectar"
              :loading="patSaving"
              :disabled="!pat.trim() || patSaving"
              @click="connectPat"
            />
          </div>
          <UAlert v-if="patError" color="error" variant="subtle" icon="i-lucide-circle-x" :title="patError" />
        </div>
      </template>
    </div>
  </UCard>
</template>
