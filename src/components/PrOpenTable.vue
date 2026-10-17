<script setup lang="ts">
import { fmtInt } from '../format'
import { ghName, openAging } from '../github'
import { PR_AGE_AMBER, PR_AGE_RED } from '../thresholds'
import TablePanel from './TablePanel.vue'

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
  <TablePanel title="PRs abertos — mais antigos primeiro" icon="i-lucide-git-pull-request-arrow" :count="openAging.length">
    <div v-if="openAging.length" class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>PR</th>
            <th>repo</th>
            <th>autor</th>
            <th class="num">
              idade
            </th>
            <th class="num">
              arquivos
            </th>
            <th class="num">
              +/−
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pr in openAging" :key="`${pr.repo}#${pr.number}`">
            <td class="max-w-[420px]">
              <UTooltip :text="pr.title">
                <a
                  :href="pr.url"
                  target="_blank"
                  rel="noopener"
                  class="text-primary hover:underline truncate block"
                >
                  #{{ pr.number }} {{ pr.title }}
                </a>
              </UTooltip>
              <UBadge v-if="pr.draft" color="neutral" variant="soft" size="sm" class="mt-0.5">
                rascunho
              </UBadge>
            </td>
            <td class="whitespace-nowrap text-muted">
              {{ pr.repo }}
            </td>
            <td class="whitespace-nowrap">
              {{ ghName(pr.author) }}
            </td>
            <td class="num whitespace-nowrap" :class="ageColor(pr.ageDays)">
              {{ pr.ageDays === 0 ? 'hoje' : `${pr.ageDays}d` }}
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
      Nenhum PR aberto nos filtros atuais <UIcon name="i-lucide-party-popper" class="size-4 align-[-2px]" />
    </div>
  </TablePanel>
</template>
