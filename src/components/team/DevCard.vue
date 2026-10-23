<script setup lang="ts">
/**
 * Card de dev no editor de time: avatar de iniciais, cargo/descrição, badges
 * de time com a cor do time, aliases resumidos (completo no tooltip) e acesso
 * rápido ao perfil de commits. Bots não recebem ação de editar.
 */
import { useI18n } from 'vue-i18n'
import { avatarBgClass, initialsOf } from '@/team'

defineProps<{
  name: string
  title: string | null
  description: string | null
  emails: string[]
  githubLogins: string[]
  /** [{ name, color }] — cores vindas do editor/time.json */
  teamBadges: { name: string, color: string | null }[]
  bot: boolean
  /** tem commits nos dados → link para /devs/:name */
  hasProfile: boolean
  editable: boolean
}>()
const emit = defineEmits<{ edit: [] }>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <UCard :ui="{ body: 'p-3 sm:p-4' }">
    <div class="flex items-start gap-3">
      <span
        :class="`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarBgClass(name)}`"
      >
        {{ initialsOf(name) }}
      </span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5">
          <UTooltip v-if="hasProfile" :text="t('team.dev.viewProfile')" class="min-w-0 flex-1">
            <RouterLink
              :to="{ name: '/devs/[name]', params: { name } }"
              class="font-medium truncate hover:text-primary min-w-0 flex-1"
            >
              {{ name }}
            </RouterLink>
          </UTooltip>
          <span v-else class="font-medium truncate min-w-0 flex-1">
            {{ name }}
          </span>
          <UBadge v-if="bot" color="warning" variant="subtle" size="xs" class="shrink-0">
            {{ t('team.dev.bot') }}
          </UBadge>
          <UButton
            v-if="editable"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            square
            class="shrink-0"
            :aria-label="t('team.dev.editProfile')"
            @click="emit('edit')"
          />
        </div>
        <div v-if="title" class="text-xs font-medium text-primary truncate">
          {{ title }}
        </div>
        <div v-if="description" class="text-xs text-dimmed line-clamp-2">
          {{ description }}
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-1">
          <UBadge
            v-for="tb in teamBadges"
            :key="tb.name"
            variant="soft"
            size="xs"
            :style="tb.color ? { backgroundColor: `${tb.color}22`, color: tb.color } : {}"
          >
            {{ tb.name }}
          </UBadge>
          <span v-if="!teamBadges.length" class="text-xs text-dimmed italic">
            {{ t('team.dev.noTeam') }}
          </span>
        </div>

        <div v-if="emails.length || githubLogins.length" class="mt-1.5 flex items-center gap-3 text-xs text-dimmed">
          <UTooltip v-if="githubLogins.length" :text="githubLogins.join(', ')">
            <button type="button" class="inline-flex items-center gap-1 cursor-default" :aria-label="t('team.dev.loginsAria', { n: githubLogins.length, list: githubLogins.join(', ') })">
              <UIcon name="i-lucide-github" class="size-3.5" />
              {{ t(githubLogins.length > 1 ? 'team.dev.loginMany' : 'team.dev.loginOne', { n: githubLogins.length }) }}
            </button>
          </UTooltip>
          <UTooltip v-if="emails.length" :text="emails.join(', ')">
            <button type="button" class="inline-flex items-center gap-1 cursor-default" :aria-label="t('team.dev.emailsAria', { n: emails.length, list: emails.join(', ') })">
              <UIcon name="i-lucide-mail" class="size-3.5" />
              {{ t(emails.length > 1 ? 'team.dev.emailMany' : 'team.dev.emailOne', { n: emails.length }) }}
            </button>
          </UTooltip>
        </div>
      </div>
    </div>
  </UCard>
</template>
