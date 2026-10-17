<script setup lang="ts">
import type { OrgEntry, RepoEntry, SetupStatus } from '@/setup'
/**
 * Escolha de repositórios da org — usado pelo passo 2 do wizard e pelo
 * "gerenciar repositórios" nas configurações. `manage` pré-seleciona os repos
 * atuais e detecta desmarcações como remoção explícita do disco. Remoções são
 * destrutivas: só seguem para o submit depois do modal de confirmação.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { fetchOrgs, fetchRepos } from '@/setup'

const props = defineProps<{
  status: SetupStatus | null
  mode?: 'wizard' | 'manage'
}>()
const emit = defineEmits<{
  submit: [payload: { org: string, repos: string[], remove: string[] }]
}>()

const mode = computed(() => props.mode ?? 'wizard')

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
/** o usuário já mexeu na seleção/org — o refresh de status não pode descartar isso */
const touched = ref(false)
/** modal de confirmação de remoção do disco aberto */
const showConfirm = ref(false)
/** token de ordem das listagens de repos — uma resposta atrasada de uma org
 * anterior não pode sobrescrever a lista/seleção da org atual */
let reqId = 0

function precheck(list: RepoEntry[]) {
  const names = list.map(r => r.name)
  if (mode.value === 'manage') {
    // gerenciamento: pré-seleciona os repos que já estão no dashboard
    const current = new Set(props.status?.repos ?? [])
    const sel = names.filter(n => current.has(n))
    checked.value = sel
    initialChecked.value = [...sel]
    return
  }
  // wizard: pré-seleciona o padrão do time (ou tudo que não está arquivado)
  const defaults = (props.status?.defaultRepos ?? []).map(n => n.toLowerCase())
  const inDefaults = names.filter(n => defaults.includes(n.toLowerCase()))
  checked.value = inDefaults.length ? inDefaults : list.filter(r => !r.archived).map(r => r.name)
  initialChecked.value = []
}

async function loadRepos(org: string) {
  const id = ++reqId
  loadingRepos.value = true
  reposError.value = null
  repos.value = []
  try {
    const list = await fetchRepos(org)
    // resposta de uma org anterior chegou atrasada — descarta
    if (id !== reqId)
      return
    repos.value = list
    precheck(list)
  }
  catch (err) {
    if (id === reqId)
      reposError.value = (err as Error).message
  }
  finally {
    if (id === reqId)
      loadingRepos.value = false
  }
}

onMounted(async () => {
  try {
    orgs.value = await fetchOrgs()
    const defaultOrg = props.status?.defaultOrg
    selectedOrg.value = orgItems.value.find(o => o.value === defaultOrg)?.value ?? orgItems.value[0]?.value ?? null
  }
  catch (err) {
    reposError.value = (err as Error).message
  }
})

/** troca de org escolhida pelo usuário — conta como interação */
function selectOrg(value: string | null) {
  touched.value = true
  selectedOrg.value = value
}

watch(selectedOrg, (org) => {
  if (org)
    loadRepos(org)
})

// o status chega antes/depois da lista de repos (mount do filho corre antes do
// await do pai) — corrige a org default e refaz a pré-seleção quando ele chega.
// Se o usuário já interagiu (touched), a seleção manual sobrevive: nada é
// resetado — só a linha de base de "repos em disco" é atualizada para o
// cálculo de `removed` continuar preciso
watch(() => props.status, (st) => {
  if (!st)
    return
  if (!touched.value) {
    let orgChanged = false
    if (st.defaultOrg && selectedOrg.value !== st.defaultOrg) {
      const match = orgItems.value.find(o => o.value === st.defaultOrg)
      if (match) {
        selectedOrg.value = match.value
        orgChanged = true
      }
    }
    // com a org trocada o loadRepos já refaz a pré-seleção da lista nova
    if (!orgChanged && repos.value.length)
      precheck(repos.value)
    return
  }
  if (mode.value !== 'manage' || !repos.value.length)
    return
  const current = new Set(st.repos)
  const freshSel = repos.value.map(r => r.name).filter(n => current.has(n))
  const seen = new Set(initialChecked.value)
  // entradas novas em disco que o usuário nunca viu entram marcadas; o resto da
  // seleção (marcadas e desmarcadas) fica exatamente como ele deixou
  checked.value = [...new Set([...checked.value, ...freshSel.filter(n => !seen.has(n))])]
  initialChecked.value = freshSel
})

function toggle(name: string, on: boolean) {
  touched.value = true
  checked.value = on ? [...checked.value, name] : checked.value.filter(n => n !== name)
}

/** seleção rápida: padrão do time (GITVIEW_DEFAULT_REPOS), caindo pra tudo não-arquivado */
function applyTimeDefault() {
  touched.value = true
  const defaults = (props.status?.defaultRepos ?? []).map(n => n.toLowerCase())
  const sel = repos.value.filter(r => defaults.includes(r.name.toLowerCase())).map(r => r.name)
  checked.value = sel.length ? sel : repos.value.filter(r => !r.archived).map(r => r.name)
}

function selectAll() {
  touched.value = true
  checked.value = repos.value.filter(r => !r.archived).map(r => r.name)
}

function clearSelection() {
  touched.value = true
  checked.value = []
}

function submit() {
  const org = selectedOrg.value === '@user'
    ? (props.status?.auth?.login ?? '')
    : (selectedOrg.value ?? '')
  emit('submit', { org, repos: [...checked.value], remove: [...removed.value] })
}

/** apagar clones do disco é destrutivo — com repos em `removed`, o clique abre o
 * modal de confirmação listando os nomes; sem remoções, aplica direto */
function requestSubmit() {
  if (removed.value.length) {
    showConfirm.value = true
    return
  }
  submit()
}

function confirmSubmit() {
  showConfirm.value = false
  submit()
}
</script>

<template>
  <UCard>
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-2 font-medium">
        <UIcon name="i-lucide-package" class="size-5" />
        {{ mode === 'manage' ? 'Gerenciar repositórios' : 'Quais repositórios entram no dashboard?' }}
      </div>

      <USelectMenu
        :model-value="selectedOrg"
        :items="orgItems"
        value-key="value"
        placeholder="organização"
        class="w-full"
        @update:model-value="selectOrg"
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
          <UBadge v-if="mode === 'manage' && status?.repos.includes(r.name)" color="primary" variant="soft" size="sm">
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
            @click="selectAll"
          />
          <UButton label="nenhum" size="xs" color="neutral" variant="link" @click="clearSelection" />
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
        <!-- slot p/ o botão "voltar" do chamador (wizard: voltar ao passo 1; settings: nada) -->
        <slot name="back" />
        <UButton
          :label="mode === 'manage' ? 'aplicar mudanças' : 'clonar e coletar'"
          trailing-icon="i-lucide-arrow-right"
          :disabled="mode === 'wizard' && !checked.length"
          @click="requestSubmit"
        />
      </div>
    </div>

    <!-- modal de confirmação de remoção: lista o que sai do disco antes do submit -->
    <UModal v-model:open="showConfirm" title="apagar repositórios do disco?">
      <template #body>
        <div class="flex flex-col gap-3 text-sm">
          <p>Os clones abaixo serão <span class="font-medium">apagados do disco</span>:</p>
          <ul class="flex flex-col gap-1 rounded-lg border border-default px-3 py-2">
            <li v-for="n in removed" :key="n" class="flex items-center gap-2">
              <UIcon name="i-lucide-trash-2" class="size-4 text-error" />
              <span class="font-mono">{{ n }}</span>
            </li>
          </ul>
          <p class="text-dimmed">
            Os dados deles saem do dashboard na próxima coleta. Para manter algum, cancele e deixe-o marcado.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton label="cancelar" color="neutral" variant="ghost" size="sm" @click="showConfirm = false" />
          <UButton label="apagar e aplicar" color="error" size="sm" @click="confirmSubmit" />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
