<script setup lang="ts">
import type { ProfileDraft } from '@/team'
/**
 * Modal de edição do perfil de um dev (título/descrição/aliases). Trabalha sobre
 * uma CÓPIA local do draft — nada de mutar props (fluxo unidirecional, issue #40);
 * aplicar emite o draft e o composable normaliza as listas.
 */
import { computed, reactive, watch } from 'vue'
import { dedupeList, toProfileDraft } from '@/team'

const props = defineProps<{
  devName: string
  /** draft atual do dev (opcional) — copiado pro estado local quando o modal abre */
  profile?: ProfileDraft
}>()

const emit = defineEmits<{ apply: [draft: ProfileDraft] }>()

const open = defineModel<boolean>('open')

const draft = reactive<ProfileDraft>({ title: '', description: '', emails: '', githubLogins: '' })

// sincroniza a cópia local na abertura (ou ao trocar de dev)
watch([open, () => props.devName], ([isOpen]) => {
  if (isOpen)
    Object.assign(draft, props.profile ?? toProfileDraft())
}, { immediate: true })

const emailBadges = computed(() => dedupeList(draft.emails))
const loginBadges = computed(() => dedupeList(draft.githubLogins))

function apply() {
  emit('apply', { ...draft })
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="`perfil de ${devName}`">
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
          <div v-if="emailBadges.length" class="flex flex-wrap gap-1 mt-1.5">
            <UBadge v-for="e in emailBadges" :key="e" color="neutral" variant="soft" size="xs" class="font-mono">
              {{ e }}
            </UBadge>
          </div>
        </UFormField>
        <UFormField label="logins do GitHub" description="separados por vírgula — unifica logins do mesmo dev em PRs">
          <UTextarea v-model="draft.githubLogins" placeholder="login1, login2" :rows="2" class="w-full font-mono text-xs" />
          <div v-if="loginBadges.length" class="flex flex-wrap gap-1 mt-1.5">
            <UBadge v-for="l in loginBadges" :key="l" color="neutral" variant="soft" size="xs" class="font-mono">
              {{ l }}
            </UBadge>
          </div>
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton label="cancelar" color="neutral" variant="ghost" size="sm" @click="open = false" />
        <UButton label="aplicar" size="sm" @click="apply" />
      </div>
    </template>
  </UModal>
</template>
