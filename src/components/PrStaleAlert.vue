<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ghName, stalePrs } from '../github'
import { PR_AGE_ERROR_DAYS, PR_STALE_DAYS, PR_STALE_ERROR_COUNT } from '../thresholds'
import PrLinkCell from './PrLinkCell.vue'

const { t } = useI18n({ useScope: 'global' })

const stale = computed(() => stalePrs(PR_STALE_DAYS))
const oldest = computed(() => stale.value[0] ?? null)
const shown = computed(() => stale.value.slice(0, 5))
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-hourglass" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">{{ t('ui.prStale.title', { n: PR_STALE_DAYS }) }}</span>
        <UBadge v-if="stale.length" :color="stale.length >= PR_STALE_ERROR_COUNT ? 'error' : 'warning'" variant="soft" size="sm" class="ml-auto">
          {{ stale.length }}
        </UBadge>
      </div>
    </template>

    <p v-if="stale.length === 0" class="text-muted text-sm">
      {{ t('ui.prStale.empty', { n: PR_STALE_DAYS }) }} <UIcon name="i-lucide-thumbs-up" class="size-4 align-[-2px]" />
    </p>

    <template v-else>
      <table class="data-table">
        <tbody>
          <tr v-for="pr in shown" :key="`${pr.repo}#${pr.number}`">
            <td>
              <PrLinkCell :pr="pr" class="max-w-[380px]" />
            </td>
            <td class="whitespace-nowrap text-muted">
              {{ pr.repo }}
            </td>
            <td class="whitespace-nowrap text-muted">
              {{ ghName(pr.author) }}
            </td>
            <td class="num whitespace-nowrap">
              <span :class="pr.ageDays >= PR_AGE_ERROR_DAYS ? 'text-error font-medium' : 'text-warning'">{{ t('ui.days', { n: pr.ageDays }) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="text-dimmed text-xs mt-2.5">
        <template v-if="stale.length > shown.length">{{ t('ui.prStale.showing', { shown: shown.length, total: stale.length }) }}</template>
        {{ t('ui.prStale.footer', { days: oldest?.ageDays }) }}
      </p>
    </template>
  </UCard>
</template>
