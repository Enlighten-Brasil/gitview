<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { filters, isBot, stats } from '../data'

const router = useRouter()

/** clique na linha abre a página dedicada do dev */
function openDev(author: string) {
  router.push({ name: '/devs/[name]', params: { name: author } })
}

type Key = 'commits' | 'additions' | 'deletions' | 'repos' | 'activeDays' | 'lastCommit' | 'streak'
const sortKey = ref<Key>('commits')
const sortAsc = ref(false)

function toggleSort(key: Key) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  }
  else {
    sortKey.value = key
    sortAsc.value = false
  }
}

const visibleAuthors = computed(() => {
  const selected = filters.authors
  const rows = (stats.value?.perAuthor ?? []).filter(a => filters.showBots || !isBot(a.author))
  const filtered = selected.length ? rows.filter(r => selected.includes(r.author)) : rows
  return [...filtered].sort((a, b) => {
    const av = a[sortKey.value]
    const bv = b[sortKey.value]
    const cmp = typeof av === 'number' ? av - (bv as number) : String(av).localeCompare(String(bv))
    return sortAsc.value ? cmp : -cmp
  })
})

function fmt(n: number) {
  return n.toLocaleString('pt-BR')
}
function fmtDate(iso: string) {
  if (!iso)
    return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function exportCsv() {
  const header = ['dev', 'commits', 'linhas_adicionadas', 'linhas_removidas', 'repos', 'dias_ativos', 'commits_por_dia_ativo', 'streak_atual', 'streak_max', 'ultimo_commit']
  const lines = visibleAuthors.value.map(a => [
    a.author,
    a.commits,
    a.additions,
    a.deletions,
    a.repos,
    a.activeDays,
    (a.commits / Math.max(a.activeDays, 1)).toFixed(2),
    a.streak,
    a.longestStreak,
    a.lastCommit.slice(0, 10),
  ].join(';'))
  const BOM = String.fromCharCode(0xFEFF) // BOM p/ Excel abrir UTF-8 corretamente
  const csv = `${BOM + header.join(';')}\n${lines.join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `ranking-time-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold text-highlighted">
          Ranking do time (histórico completo)
        </h2>
        <UButton
          icon="i-lucide-download"
          label="CSV"
          color="neutral"
          variant="soft"
          size="xs"
          @click="exportCsv"
        />
      </div>
    </template>
    <table class="data-table">
      <thead>
        <tr>
          <th>Dev</th>
          <th class="num sortable" @click="toggleSort('commits')">
            commits
          </th>
          <th class="num sortable" @click="toggleSort('additions')">
            + linhas
          </th>
          <th class="num sortable" @click="toggleSort('deletions')">
            − linhas
          </th>
          <th class="num sortable" @click="toggleSort('repos')">
            repos
          </th>
          <th class="num sortable" @click="toggleSort('activeDays')">
            dias ativos
          </th>
          <th class="num">
            commits/dia ativo
          </th>
          <th class="num sortable" @click="toggleSort('streak')">
            streak 🔥
          </th>
          <th class="num sortable" @click="toggleSort('lastCommit')">
            último commit
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="a in visibleAuthors"
          :key="a.author"
          class="dev-row"
          @click="openDev(a.author)"
        >
          <td>{{ a.author }}</td>
          <td class="num">
            {{ fmt(a.commits) }}
          </td>
          <td class="num add">
            {{ fmt(a.additions) }}
          </td>
          <td class="num del">
            {{ fmt(a.deletions) }}
          </td>
          <td class="num">
            {{ a.repos }}
          </td>
          <td class="num">
            {{ a.activeDays }}
          </td>
          <td class="num">
            {{ (a.commits / Math.max(a.activeDays, 1)).toFixed(1) }}
          </td>
          <td class="num">
            <div class="flex items-center justify-end gap-1.5">
              <UBadge
                icon="i-lucide-flame"
                :label="String(a.streak)"
                :color="a.streak > 0 ? 'warning' : 'neutral'"
                :variant="a.streak > 0 ? 'subtle' : 'outline'"
                size="sm"
              />
              <span class="text-xs text-dimmed">máx {{ a.longestStreak }}</span>
            </div>
          </td>
          <td class="num">
            {{ fmtDate(a.lastCommit) }}
          </td>
        </tr>
      </tbody>
    </table>
  </UCard>
</template>

<style scoped>
.dev-row {
  cursor: pointer;
}
.dev-row:hover {
  background: var(--ui-bg-elevated);
}
.dev-row.selected {
  background: color-mix(in oklab, var(--ui-primary) 12%, transparent);
}
</style>
