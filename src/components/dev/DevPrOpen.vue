<script setup lang="ts">
/**
 * PRs abertos do dev (issue #41) — estado atual ("agora"), fora do filtro de
 * período. Painel só renderiza com PR aberto (mesmo comportamento da página).
 */
import { computed } from 'vue'
import PrLinkCell from '@/components/PrLinkCell.vue'
import TablePanel from '@/components/TablePanel.vue'
import { daysSince } from '@/format'
import { ghName, github } from '@/github'

const props = defineProps<{ dev: string }>()

const myOpen = computed(() =>
  (github.value?.prs ?? []).filter(pr => ghName(pr.author) === props.dev && pr.state === 'OPEN'),
)
</script>

<template>
  <TablePanel v-if="myOpen.length" :title="`PRs abertos de ${props.dev.split(' ')[0]}`" icon="i-lucide-git-pull-request-arrow" :count="myOpen.length">
    <table class="data-table">
      <tbody>
        <tr v-for="pr in myOpen" :key="`${pr.repo}#${pr.number}`">
          <td>
            <PrLinkCell :pr="pr" class="max-w-[480px]" />
          </td>
          <td class="whitespace-nowrap text-muted">
            {{ pr.repo }}
          </td>
          <td class="num whitespace-nowrap text-muted">
            {{ daysSince(pr.createdAt) }}d aberto
          </td>
        </tr>
      </tbody>
    </table>
  </TablePanel>
</template>
