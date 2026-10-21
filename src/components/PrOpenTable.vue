<script setup lang="ts">
import { fmtInt } from '../format'
import { ghName, openAging } from '../github'
import { PR_AGE_AMBER, PR_AGE_RED } from '../thresholds'
import PrLinkCell from './PrLinkCell.vue'
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
      Nenhum PR aberto agora <UIcon name="i-lucide-party-popper" class="size-4 align-[-2px]" />
    </div>

    <!-- janela fixa (categoria do AGENTS.md) — o recorte de escopo vale, o de período não -->
    <p class="text-dimmed text-xs px-4 pb-3 pt-2.5">
      janela fixa: abertos agora — segue escopo, ignora o período
    </p>
  </TablePanel>
</template>
