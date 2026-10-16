<script setup lang="ts">
import { computed } from 'vue'
import { isBot, stats } from '../data'

const REPO_STALE_DAYS = 30
const DEV_STALE_DAYS = 21

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

/** repos sem commits há 30+ dias */
const staleRepos = computed(() =>
  (stats.value?.perRepo ?? [])
    .map(r => ({ repo: r.repo, days: daysSince(r.lastCommit), last: r.lastCommit }))
    .filter(r => r.days >= REPO_STALE_DAYS)
    .sort((a, b) => b.days - a.days),
)

/** devs sem commits há 21+ dias (ignora bots) — alguém travado ou de férias? */
const staleDevs = computed(() =>
  (stats.value?.perAuthor ?? [])
    .filter(a => !isBot(a.author))
    .map(a => ({ author: a.author, days: daysSince(a.lastCommit), last: a.lastCommit }))
    .filter(a => a.days >= DEV_STALE_DAYS)
    .sort((a, b) => b.days - a.days),
)

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR')
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-pause-circle" class="size-4 text-warning" />
        <span class="text-sm font-semibold text-highlighted">Inatividade — repos e devs parados</span>
      </div>
    </template>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
          repos sem commit há {{ REPO_STALE_DAYS }}+ dias
        </h3>
        <p v-if="staleRepos.length === 0" class="text-muted text-sm">
          Todos os repos ativos. 👍
        </p>
        <table v-else class="data-table">
          <tbody>
            <tr v-for="r in staleRepos" :key="r.repo">
              <td class="font-medium">{{ r.repo }}</td>
              <td class="num whitespace-nowrap text-muted">{{ fmtDate(r.last) }}</td>
              <td class="num whitespace-nowrap">
                <span :class="r.days >= 90 ? 'text-error font-medium' : 'text-warning'">{{ r.days }}d</span>
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
          Todo mundo commitou recentemente. 👍
        </p>
        <table v-else class="data-table">
          <tbody>
            <tr v-for="d in staleDevs" :key="d.author">
              <td>{{ d.author }}</td>
              <td class="num whitespace-nowrap text-muted">{{ fmtDate(d.last) }}</td>
              <td class="num whitespace-nowrap">
                <span :class="d.days >= 60 ? 'text-error font-medium' : 'text-warning'">{{ d.days }}d</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <p class="text-dimmed text-xs mt-2.5">
      ignora os filtros da sidebar (inatividade é medida até hoje, sobre todos os repos/devs) · dev inativo pode estar de férias ou travado — vale um 1:1
    </p>
  </UCard>
</template>
