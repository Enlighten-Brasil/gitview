<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { fmtInt } from '../format'
import { ghName, openAging } from '../github'
import { PR_AGE_AMBER, PR_AGE_RED } from '../thresholds'
import PrLinkCell from './PrLinkCell.vue'
import TablePanel from './TablePanel.vue'

const { t } = useI18n({ useScope: 'global' })

/** cor da idade: >PR_AGE_RED vermelho, >PR_AGE_AMBER amarelo, senão neutro */
function ageColor(days: number): string {
  if (days > PR_AGE_RED)
    return 'text-error font-semibold'
  if (days > PR_AGE_AMBER)
    return 'text-warning font-semibold'
  return 'text-muted'
}
</script>

<template>
  <TablePanel :title="t('ui.prOpen.title')" icon="i-lucide-git-pull-request-arrow" :count="openAging.length">
    <div v-if="openAging.length" class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>{{ t('ui.th.pr') }}</th>
            <th>{{ t('ui.th.repo') }}</th>
            <th>{{ t('ui.th.author') }}</th>
            <th class="num">
              {{ t('ui.th.age') }}
            </th>
            <th class="num">
              {{ t('ui.th.files') }}
            </th>
            <th class="num">
              {{ t('ui.th.diff') }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pr in openAging" :key="`${pr.repo}#${pr.number}`">
            <td>
              <PrLinkCell :pr="pr" class="max-w-[420px]" />
            </td>
            <td class="whitespace-nowrap text-muted">
              {{ pr.repo }}
            </td>
            <td class="whitespace-nowrap">
              {{ ghName(pr.author) }}
            </td>
            <td class="num whitespace-nowrap" :class="ageColor(pr.ageDays)">
              {{ pr.ageDays === 0 ? t('ui.today') : t('ui.days', { n: pr.ageDays }) }}
            </td>
            <td class="num text-muted">
              {{ pr.changedFiles }}
            </td>
            <td class="num whitespace-nowrap">
              <span class="add">+{{ fmtInt(pr.additions) }}</span>
              <span class="del ml-1">−{{ fmtInt(pr.deletions) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="py-10 text-center text-sm text-muted">
      {{ t('ui.prOpen.empty') }} <UIcon name="i-lucide-party-popper" class="size-4 align-[-2px]" />
    </div>

    <!-- janela fixa (categoria do AGENTS.md) — o recorte de escopo vale, o de período não -->
    <p class="text-dimmed text-xs px-4 pb-3 pt-2.5">
      {{ t('ui.fixedWindowOpen') }}
    </p>
  </TablePanel>
</template>
