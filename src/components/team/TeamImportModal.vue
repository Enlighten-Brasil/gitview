<script setup lang="ts">
import type { GithubTeamData } from '@/team'
import type { DevProfileInfo } from '@/types'
/**
 * Slideover de import do GitHub: times e membros da org (GET /__team/github).
 * O payload da org é só-lido — shallowRef, sem reatividade profunda (issue #40).
 * Ações saem por emits; quem grava é o composable na página.
 */
import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { fetchGithubTeam } from '@/team'

const props = defineProps<{
  /** devs já cadastrados — logins deles saem da lista "sem mapeamento" */
  devs: DevProfileInfo[]
  /** nomes candidatos pra associação de login */
  devNames: string[]
}>()

const emit = defineEmits<{
  'import-team': [team: GithubTeamData['teams'][number]]
  'assign-login': [dev: string, login: string]
}>()

const open = defineModel<boolean>('open')

const gh = shallowRef<GithubTeamData | null>(null)
const ghLoading = ref(false)
const ghError = ref<string | null>(null)
const assignTarget = reactive<Record<string, string>>({})

// busca a org na primeira abertura (uma única vez — o payload depois é cache)
watch(open, async (isOpen) => {
  if (!isOpen || gh.value || ghLoading.value)
    return
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
})

/** logins da org ainda não mapeados pra nenhum dev */
const unmappedGhMembers = computed(() => {
  if (!gh.value)
    return []
  const mapped = new Set(props.devs.flatMap(d => d.githubLogins.map(l => l.toLowerCase())))
  return gh.value.members.filter(m => !mapped.has(m.login.toLowerCase()))
})

function importTeam(t: GithubTeamData['teams'][number]) {
  emit('import-team', t)
  open.value = false
}
</script>

<template>
  <USlideover v-model:open="open" title="importar do GitHub">
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
                @click="emit('assign-login', assignTarget[m.login], m.login)"
              />
            </div>
          </div>
        </div>
      </div>
    </template>
  </USlideover>
</template>
