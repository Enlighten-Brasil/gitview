<script setup lang="ts">
/**
 * Card de dev no editor de time: avatar de iniciais, cargo/descrição, badges
 * de time com a cor do time, aliases resumidos (completo no tooltip) e acesso
 * rápido ao perfil de commits. Bots não recebem ação de editar.
 */
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
          <RouterLink
            v-if="hasProfile"
            :to="{ name: '/devs/[name]', params: { name } }"
            class="font-medium truncate hover:text-primary min-w-0 flex-1"
            title="ver perfil de commits"
          >
            {{ name }}
          </RouterLink>
          <span v-else class="font-medium truncate min-w-0 flex-1">
            {{ name }}
          </span>
          <UBadge v-if="bot" color="warning" variant="subtle" size="xs" class="shrink-0">
            bot
          </UBadge>
          <UButton
            v-if="editable"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            square
            class="shrink-0"
            aria-label="editar perfil"
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
            sem time
          </span>
        </div>

        <div v-if="emails.length || githubLogins.length" class="mt-1.5 flex items-center gap-3 text-xs text-dimmed">
          <UTooltip v-if="githubLogins.length" :text="githubLogins.join(', ')">
            <button type="button" class="inline-flex items-center gap-1 cursor-default" :aria-label="`logins do GitHub (${githubLogins.length}): ${githubLogins.join(', ')}`">
              <UIcon name="i-lucide-github" class="size-3.5" />
              {{ githubLogins.length }} login{{ githubLogins.length > 1 ? 's' : '' }}
            </button>
          </UTooltip>
          <UTooltip v-if="emails.length" :text="emails.join(', ')">
            <button type="button" class="inline-flex items-center gap-1 cursor-default" :aria-label="`e-mails de commit (${emails.length}): ${emails.join(', ')}`">
              <UIcon name="i-lucide-mail" class="size-3.5" />
              {{ emails.length }} e-mail{{ emails.length > 1 ? 's' : '' }}
            </button>
          </UTooltip>
        </div>
      </div>
    </div>
  </UCard>
</template>
