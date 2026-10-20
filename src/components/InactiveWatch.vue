<script setup lang="ts">
import { computed } from 'vue'
import { isBot, stats } from '../data'
import { daysSince, fmtDate } from '../format'
import { DEV_STALE_DAYS, DEV_STALE_ERROR_DAYS, REPO_STALE_DAYS, REPO_STALE_ERROR_DAYS } from '../thresholds'
import TablePanel from './TablePanel.vue'

/** repos sem commits há REPO_STALE_DAYS+ dias */
const staleRepos = computed(() =>
  (stats.value?.perRepo ?? [])
    .map(r => ({ repo: r.repo, days: daysSince(r.lastCommit), last: r.lastCommit }))
    .filter(r => r.days >= REPO_STALE_DAYS)
    .sort((a, b) => b.days - a.days),
)

/** devs sem commits há DEV_STALE_DAYS+ dias (ignora bots) — alguém travado ou de férias? */
const staleDevs = computed(() =>
  (stats.value?.perAuthor ?? [])
    .filter(a => !isBot(a.author))
    .map(a => ({ author: a.author, days: daysSince(a.lastCommit), last: a.lastCommit }))
    .filter(a => a.days >= DEV_STALE_DAYS)
    .sort((a, b) => b.days - a.days),
)
</script>

<template>
  <TablePanel title="Inatividade — repos e devs parados" icon="i-lucide-pause-circle" icon-class="text-warning">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 pt-4">
      <div>
        <h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          repos sem commit há {{ REPO_STALE_DAYS }}+ dias
        </h3>
        <p v-if="staleRepos.length === 0" class="text-muted text-sm">
          Todos os repos ativos. <UIcon name="i-lucide-thumbs-up" class="size-4 align-[-2px]" />
        </p>
        <table v-else class="data-table">
          <tbody>
            <tr v-for="r in staleRepos" :key="r.repo">
              <td class="font-medium">
                {{ r.repo }}
              </td>
              <td class="num whitespace-nowrap text-muted">
                {{ fmtDate(r.last) }}
              </td>
              <td class="num whitespace-nowrap">
                <span :class="r.days >= REPO_STALE_ERROR_DAYS ? 'text-error font-medium' : 'text-warning'">{{ r.days }}d</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div>
        <h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          devs sem commit há {{ DEV_STALE_DAYS }}+ dias
        </h3>
        <p v-if="staleDevs.length === 0" class="text-muted text-sm">
          Todo mundo commitou recentemente. <UIcon name="i-lucide-thumbs-up" class="size-4 align-[-2px]" />
        </p>
        <table v-else class="data-table">
          <tbody>
            <tr v-for="d in staleDevs" :key="d.author">
              <td>{{ d.author }}</td>
              <td class="num whitespace-nowrap text-muted">
                {{ fmtDate(d.last) }}
              </td>
              <td class="num whitespace-nowrap">
                <span :class="d.days >= DEV_STALE_ERROR_DAYS ? 'text-error font-medium' : 'text-warning'">{{ d.days }}d</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="text-dimmed text-xs px-4 pb-3 pt-2.5">
      ignora os filtros da sidebar, inclusive o escopo (inatividade é medida até hoje, sobre todos os repos/devs) · dev inativo pode estar de férias ou travado — vale um 1:1
    </p>
  </TablePanel>
</template>
