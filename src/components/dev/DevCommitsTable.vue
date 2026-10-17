<script setup lang="ts">
/**
 * Últimos commits do dev (issue #41) — a amostra do commits.json (100/autor)
 * filtrada pelo período, limitada a 50 linhas.
 */
import { computed } from 'vue'
import TablePanel from '@/components/TablePanel.vue'
import { inPeriodMonth, recentCommits, stats } from '@/data'
import { fmtDateTime, fmtInt } from '@/format'

const props = defineProps<{ dev: string }>()

/** link pro commit no GitHub (quando o repo tem remote mapeado) */
function commitUrl(repo: string, hash: string): string | null {
  const base = stats.value?.repoUrls?.[repo]
  return base ? `${base}/commit/${hash}` : null
}

/**
 * linhas da tabela com o link pré-composto (issue #42) — o template consome
 * `url: string | null` direto, sem non-null assertion (fora do typecheck)
 */
const commits = computed(() =>
  (recentCommits.value ?? [])
    .filter(c => c.author === props.dev && inPeriodMonth(c.date.slice(0, 7)))
    .slice(0, 50)
    .map(c => ({ ...c, url: commitUrl(c.repo, c.hash) })),
)
</script>

<template>
  <TablePanel title="Últimos commits" icon="i-lucide-history" :count="commits.length">
    <div v-if="commits.length" class="overflow-x-auto">
      <table class="data-table">
        <thead>
          <tr>
            <th>data</th>
            <th>repo</th>
            <th>hash</th>
            <th>mensagem</th>
            <th class="num">
              +/−
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in commits" :key="`${c.repo}@${c.hash}`">
            <td class="whitespace-nowrap text-muted">
              {{ fmtDateTime(c.date) }}
            </td>
            <td class="whitespace-nowrap text-muted">
              {{ c.repo }}
            </td>
            <td>
              <a
                v-if="c.url"
                :href="c.url"
                target="_blank"
                rel="noopener"
                class="text-primary hover:underline"
              ><code class="text-xs bg-accented px-1 py-0.5 rounded">{{ c.hash }}</code></a>
              <code v-else class="text-xs bg-accented px-1 py-0.5 rounded">{{ c.hash }}</code>
            </td>
            <td class="max-w-[520px] truncate" :title="c.message">
              {{ c.message }}
            </td>
            <td class="num whitespace-nowrap">
              <span class="add">+{{ fmtInt(c.additions) }}</span>
              <span class="del ml-1">−{{ fmtInt(c.deletions) }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="py-10 text-center text-sm text-muted">
      Sem commits no período — ajuste o filtro ou rode <code>pnpm collect</code> para gerar o commits.json.
    </div>
  </TablePanel>
</template>
