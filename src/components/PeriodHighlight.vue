<script setup lang="ts">
/**
 * Destaque do período (mais commits no filtro atual) — mora em /devs, onde
 * moram as demais métricas por pessoa. Fica fora do grid pra nunca truncar.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { commitsByAuthor, filteredCommitCount } from '../data'
import { fmtInt } from '../format'

const { t } = useI18n({ useScope: 'global' })

const top = computed(() => {
  if (commitsByAuthor.value.length === 0)
    return null
  const best = commitsByAuthor.value[0]
  const share = filteredCommitCount.value > 0
    ? Math.round((best.commits / filteredCommitCount.value) * 100)
    : 0
  return { ...best, share }
})
</script>

<template>
  <div v-if="top" class="stat-card flex items-center gap-3 py-3!">
    <UIcon name="i-lucide-crown" class="size-5 text-warning shrink-0" />
    <div class="min-w-0">
      <div class="font-bold text-highlighted truncate">
        {{ top.author }}
      </div>
      <div class="text-xs text-muted">
        {{ t('ui.periodHighlight.label') }}
      </div>
    </div>
    <div class="ml-auto flex items-center gap-2.5 shrink-0">
      <span class="text-lg font-bold text-highlighted">{{ fmtInt(top.commits) }}</span>
      <UBadge color="primary" variant="soft" size="sm">
        {{ t('ui.periodHighlight.share', { n: top.share }) }}
      </UBadge>
    </div>
  </div>
</template>
