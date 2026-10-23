<script setup lang="ts">
import type { ProfileDraft } from '@/team'
/**
 * Modal de edição do perfil de um dev (título/descrição/aliases). Trabalha sobre
 * uma CÓPIA local do draft — nada de mutar props (fluxo unidirecional, issue #40);
 * aplicar emite o draft e o composable normaliza as listas.
 */
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { dedupeList, toProfileDraft } from '@/team'

const props = defineProps<{
  devName: string
  /** draft atual do dev (opcional) — copiado pro estado local quando o modal abre */
  profile?: ProfileDraft
}>()

const emit = defineEmits<{ apply: [draft: ProfileDraft] }>()

const open = defineModel<boolean>('open')

const { t } = useI18n({ useScope: 'global' })

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
  <UModal v-model:open="open" :title="t('team.profile.title', { name: devName })">
    <template #body>
      <div class="flex flex-col gap-3">
        <UFormField :label="t('team.profile.titleLabel')">
          <UInput v-model="draft.title" :placeholder="t('team.profile.titlePlaceholder')" class="w-full" />
        </UFormField>
        <UFormField :label="t('team.profile.descriptionLabel')">
          <UTextarea v-model="draft.description" :placeholder="t('team.profile.descriptionPlaceholder')" :rows="2" class="w-full" />
        </UFormField>
        <UFormField :label="t('team.profile.emailsLabel')" :description="t('team.profile.emailsHelp')">
          <UTextarea v-model="draft.emails" :placeholder="t('team.profile.emailsPlaceholder')" :rows="2" class="w-full font-mono text-xs" />
          <div v-if="emailBadges.length" class="flex flex-wrap gap-1 mt-1.5">
            <UBadge v-for="e in emailBadges" :key="e" color="neutral" variant="soft" size="xs" class="font-mono">
              {{ e }}
            </UBadge>
          </div>
        </UFormField>
        <UFormField :label="t('team.profile.loginsLabel')" :description="t('team.profile.loginsHelp')">
          <UTextarea v-model="draft.githubLogins" :placeholder="t('team.profile.loginsPlaceholder')" :rows="2" class="w-full font-mono text-xs" />
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
        <UButton :label="t('team.profile.cancel')" color="neutral" variant="ghost" size="sm" @click="open = false" />
        <UButton :label="t('team.profile.apply')" size="sm" @click="apply" />
      </div>
    </template>
  </UModal>
</template>
