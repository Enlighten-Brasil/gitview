<script setup lang="ts">
import type { PullRequest } from '../types'
import { useI18n } from 'vue-i18n'

/**
 * Célula de link de PR padronizada (issue #36) — antes a célula (link
 * truncado + tooltip do título + badge de rascunho) estava copiada em
 * PrOpenTable, PrStaleAlert e devs/[name]. A largura/max-width fica no uso
 * (classe passada via attrs).
 */
defineProps<{
  pr: Pick<PullRequest, 'number' | 'title' | 'url' | 'draft'>
}>()

const { t } = useI18n({ useScope: 'global' })
</script>

<template>
  <div>
    <UTooltip :text="pr.title">
      <a :href="pr.url" target="_blank" rel="noopener" class="text-primary hover:underline truncate block">
        #{{ pr.number }} {{ pr.title }}
      </a>
    </UTooltip>
    <UBadge v-if="pr.draft" color="neutral" variant="soft" size="sm" class="mt-0.5">
      {{ t('ui.prLink.draft') }}
    </UBadge>
  </div>
</template>
